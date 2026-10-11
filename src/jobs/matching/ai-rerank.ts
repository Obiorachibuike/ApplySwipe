import crypto from "crypto";
import db from "@/lib/db";
import { AIService } from "@/lib/ai/provider";
import { createLogger } from "@/lib/logger";
import type { Job, JobMatchScoreRecord, Profile } from "@/types";
import { recommendationFor, type JobMatchResult } from "./score";

const log = createLogger("jobs:matching:ai");

/**
 * Stage 2 - AI re-ranking.
 *
 * Pipeline:
 *   10,000 jobs -> hard filtering -> 1,000 -> skill scoring -> 300
 *               -> lexical/vector similarity -> 100 -> AI re-rank -> top 20-50
 *
 * Only the top slice ever reaches this stage, results are cached per
 * (user, job) in `JobMatchScore` and refreshed on a TTL, so the feed never
 * depends on an LLM call. The existing grounded AI abstraction is reused - when
 * no external model is configured it runs the zero-cost local engine, and the
 * same interface can call a hosted model when keys are present.
 */

export const AI_RERANK_ENABLED = process.env.JOB_AI_RERANK_ENABLED !== "false";
export const AI_RERANK_TOP = Math.max(0, Number(process.env.JOB_AI_RERANK_TOP || 20));
const CACHE_TTL_HOURS = Number(process.env.JOB_AI_RERANK_CACHE_HOURS || 12);
const MAX_PER_RUN = Math.max(0, Number(process.env.JOB_AI_RERANK_MAX_PER_RUN || 25));

function profileSignature(profile: Profile | null): string {
  const payload = JSON.stringify({
    id: profile?.id,
    headline: profile?.headline,
    level: profile?.experienceLevel,
    remote: profile?.remotePreference,
    minSalary: profile?.minSalary,
    skills: (profile?.skills || []).map((skill) => skill.name).sort(),
    experiences: (profile?.experiences || []).map((experience) => `${experience.role}@${experience.company}`),
  });
  return crypto.createHash("sha1").update(payload).digest("hex");
}

function isFresh(record: JobMatchScoreRecord, now = Date.now()): boolean {
  const updated = new Date(record.updatedAt).getTime();
  if (!Number.isFinite(updated)) return false;
  return now - updated < CACHE_TTL_HOURS * 60 * 60 * 1000;
}

export interface AiRerankResult {
  jobId: string;
  score: number;
  reason: string;
  matchedSkills: string[];
  missingSkills: string[];
  recommendation: string;
  cached: boolean;
}

/**
 * Re-ranks (and caches) the top `limit` jobs for a user.
 * Never throws: any AI failure falls back to the deterministic stage-1 score.
 */
export async function rerankTopJobs(input: {
  userId: string;
  profile: Profile | null;
  ranked: { job: Job; match: JobMatchResult }[];
  limit?: number;
  persist?: boolean;
  forceRefresh?: boolean;
}): Promise<AiRerankResult[]> {
  const { userId, profile, ranked } = input;
  const limit = Math.max(0, Math.min(input.limit ?? AI_RERANK_TOP, MAX_PER_RUN));
  if (!AI_RERANK_ENABLED || limit === 0 || ranked.length === 0) return [];

  const results: AiRerankResult[] = [];
  const signature = profileSignature(profile);

  for (const entry of ranked.slice(0, limit)) {
    const job = entry.job;
    try {
      const cached = (await db.jobMatchScore.findFirst({
        where: { userId, jobId: job.id },
      })) as JobMatchScoreRecord | null;

      if (
        cached &&
        !input.forceRefresh &&
        isFresh(cached) &&
        cached.stage === "AI_RERANK" &&
        (cached.breakdown as { signature?: string } | null)?.signature === signature
      ) {
        results.push({
          jobId: job.id,
          score: cached.score,
          reason: cached.reason || entry.match.reason,
          matchedSkills: (cached.matchedSkills as string[]) || entry.match.matchedSkills,
          missingSkills: (cached.missingSkills as string[]) || entry.match.missingSkills,
          recommendation: cached.recommendation || entry.match.recommendation,
          cached: true,
        });
        continue;
      }

      const analysis = await AIService.analyzeMatch(profile as Profile, job);
      const result = analysis.result;
      const score = Math.max(0, Math.min(100, Math.round(result.overallMatch)));

      const payload = {
        userId,
        jobId: job.id,
        score,
        stage: "AI_RERANK",
        reason: result.explanation,
        matchedSkills: result.matchingSkills,
        missingSkills: result.missingSkills,
        recommendation: result.recommendation || recommendationFor(score),
        breakdown: { ...(result.breakdown || {}), signature },
      };

      if (input.persist !== false) {
        try {
          if (cached) {
            await db.jobMatchScore.update({ where: { id: cached.id }, data: payload });
          } else {
            await db.jobMatchScore.create({ data: payload });
          }
        } catch (error) {
          log.warn("failed to persist match score", {
            userId,
            jobId: job.id,
            error: (error as Error).message,
          });
        }
      }

      results.push({
        jobId: job.id,
        score,
        reason: result.explanation,
        matchedSkills: result.matchingSkills,
        missingSkills: result.missingSkills,
        recommendation: payload.recommendation,
        cached: false,
      });
    } catch (error) {
      log.warn("ai re-rank failed - falling back to deterministic score", {
        jobId: job.id,
        error: (error as Error).message,
      });
      results.push({
        jobId: job.id,
        score: entry.match.score,
        reason: entry.match.reason,
        matchedSkills: entry.match.matchedSkills,
        missingSkills: entry.match.missingSkills,
        recommendation: entry.match.recommendation,
        cached: false,
      });
    }
  }

  return results;
}

/** Applies AI re-rank results on top of the deterministic ranking. */
export function applyRerank<T extends { job: Job; match: JobMatchResult }>(
  ranked: T[],
  reranked: AiRerankResult[]
): T[] {
  if (reranked.length === 0) return ranked;
  const byJob = new Map(reranked.map((entry) => [entry.jobId, entry]));

  return ranked.map((entry) => {
    const ai = byJob.get(entry.job.id);
    if (!ai) return entry;
    return {
      ...entry,
      match: {
        ...entry.match,
        score: ai.score,
        reason: ai.reason,
        matchedSkills: ai.matchedSkills,
        missingSkills: ai.missingSkills,
        recommendation: (ai.recommendation as JobMatchResult["recommendation"]) || entry.match.recommendation,
      },
    };
  });
}

/** Removes stale cached match rows (called by the matching worker). */
export async function pruneMatchScores(userId?: string, keepPerUser = 400): Promise<number> {
  const rows = (await db.jobMatchScore.findMany({
    where: userId ? { userId } : {},
    orderBy: { updatedAt: "desc" },
  })) as JobMatchScoreRecord[];

  const counts = new Map<string, number>();
  let removed = 0;

  for (const row of rows) {
    const count = (counts.get(row.userId) || 0) + 1;
    counts.set(row.userId, count);
    if (count <= keepPerUser) continue;
    await db.jobMatchScore.delete({ where: { id: row.id } });
    removed += 1;
  }

  return removed;
}
