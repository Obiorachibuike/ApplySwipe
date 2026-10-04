import crypto from "crypto";
import db from "@/lib/db";
import type { FeedJob, Job, JobInteraction, JobSourceRef, Profile, UserPreference } from "@/types";
import { getMatchWeights, hardFilterReason, type JobMatchResult } from "@/jobs/matching/score";
import { rankJobs, type RankedJob } from "@/jobs/matching/ranking";
import { AI_RERANK_TOP, applyRerank, rerankTopJobs } from "@/jobs/matching/ai-rerank";
import { resolveOfficialApplicationUrl, sourceLabelForProvider, toPublicJob } from "./job-service";
import { isStale } from "@/jobs/ingestion/freshness";

/**
 * Personalized job feed.
 *
 *   active jobs (database)
 *     -> hard filtering (passed / applied / saved / company / remote / salary / employment)
 *     -> deterministic skill scoring (weighted, 0-100)
 *     -> lexical similarity stage
 *     -> diversity rules (max per company)
 *     -> AI re-ranking of the top slice (cached, bounded)
 *     -> cursor paginated page
 *
 * The feed never contacts a provider API and never generates jobs: it only ranks
 * real jobs that the ingestion workers already stored.
 */

export interface FeedParams {
  cursor?: string | null;
  limit?: number;
  remote?: boolean;
  minScore?: number;
  employmentType?: string;
  provider?: string;
  query?: string;
  location?: string;
  /** Include jobs the user already saved (default false). */
  includeSaved?: boolean;
  maxPerCompany?: number;
}

export interface FeedResponse {
  jobs: FeedJob[];
  nextCursor: string | null;
  total: number;
  meta: {
    candidatesScanned: number;
    hardFiltered: number;
    scored: number;
    aiReranked: number;
    diversityCapPerCompany: number;
    weights: ReturnType<typeof getMatchWeights>;
    generatedAt: string;
    personalized: boolean;
  };
}

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;

interface CursorPayload {
  o: number;
  h: string;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"));
    if (typeof parsed?.o !== "number" || typeof parsed?.h !== "string") return null;
    return parsed as CursorPayload;
  } catch {
    return null;
  }
}

/** Stable signature of the ranked set, so stale cursors restart cleanly. */
function rankingSignature(userId: string, ranked: RankedJob[]): string {
  const ids = ranked.slice(0, 300).map((entry) => `${entry.job.id}:${entry.match.score}`);
  return crypto.createHash("sha1").update(`${userId}|${ids.join(",")}`).digest("hex").slice(0, 16);
}

export interface FeedViewer {
  userId: string;
  profile: Profile | null;
  preferences?: UserPreference | null;
  interactions?: JobInteraction[];
  savedJobIds?: string[];
  appliedJobIds?: string[];
}

/** Loads everything the ranking pipeline needs for one user in 4 queries. */
export async function loadViewer(userId: string): Promise<FeedViewer> {
  const profile = (await db.profile.findUnique({
    where: { userId },
    include: { skills: true, experiences: true, educations: true, projects: true, certifications: true },
  })) as Profile | null;

  const preferences = (await db.userPreference.findUnique({ where: { userId } })) as UserPreference | null;
  const interactions = (await db.jobInteraction.findMany({ where: { userId } })) as JobInteraction[];
  const saved = await db.savedJob.findMany({ where: { userId } });
  const applications = await db.application.findMany({ where: { userId } });

  return {
    userId,
    profile,
    preferences,
    interactions,
    savedJobIds: saved.map((entry: { jobId: string }) => entry.jobId),
    appliedJobIds: applications.map((entry: { jobId: string }) => entry.jobId),
  };
}

/**
 * Jobs the user has already acted on.
 * A swipe is a decision: PASSED, LIKE and SUPER_LIKE jobs stay out of the feed,
 * as do applications and saved jobs (unless explicitly requested).
 */
export function excludedJobIds(viewer: FeedViewer, includeSaved = false): Set<string> {
  const excluded = new Set<string>();
  for (const interaction of viewer.interactions || []) {
    if (interaction.interactionType === "PASSED" || interaction.interactionType === "LIKE" || interaction.interactionType === "SUPER_LIKE") {
      excluded.add(interaction.jobId);
    }
  }
  for (const jobId of viewer.appliedJobIds || []) excluded.add(jobId);
  if (!includeSaved) {
    for (const jobId of viewer.savedJobIds || []) excluded.add(jobId);
  }
  return excluded;
}

export async function getFeed(viewer: FeedViewer, params: FeedParams = {}): Promise<FeedResponse> {
  const limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(params.limit || DEFAULT_LIMIT)));
  const maxPerCompany = Math.max(1, Math.min(10, params.maxPerCompany ?? 3));

  const allJobs = (await db.job.findMany({ where: { isActive: true }, orderBy: { postedAt: "desc" } })) as Job[];
  const excluded = excludedJobIds(viewer, params.includeSaved);

  let hardFiltered = 0;
  const candidates: Job[] = [];

  for (const job of allJobs) {
    if (job.canonicalJobId || job.isReported) continue;
    if (excluded.has(job.id)) continue;
    if (isStale(job)) continue;

    const reason = hardFilterReason({
      job,
      profile: viewer.profile,
      preferences: viewer.preferences,
      options: {
        remote: params.remote,
        employmentType: params.employmentType,
        provider: params.provider,
        query: params.query,
        location: params.location,
      },
    });

    if (reason) {
      hardFiltered += 1;
      continue;
    }

    candidates.push(job);
  }

  const ranked = rankJobs(candidates, viewer.profile, viewer.preferences, { maxPerCompany });

  // Stage 2 - AI re-ranking, bounded and cached (never the full candidate set).
  const reranked = await rerankTopJobs({
    userId: viewer.userId,
    profile: viewer.profile,
    ranked: ranked.slice(0, AI_RERANK_TOP),
    limit: AI_RERANK_TOP,
  });
  const withAi = applyRerank(ranked, reranked);

  let finalRanked = withAi;
  if (params.minScore && params.minScore > 0) {
    const aboveThreshold = withAi.filter((entry) => entry.match.score >= params.minScore!);
    finalRanked = aboveThreshold.length > 0 ? aboveThreshold : withAi.slice(0, limit);
  }

  const signature = rankingSignature(viewer.userId, finalRanked);
  const cursor = params.cursor ? decodeCursor(params.cursor) : null;
  const offset = cursor && cursor.h === signature ? cursor.o : 0;

  const page = finalRanked.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  const nextCursor =
    nextOffset < finalRanked.length ? encodeCursor({ o: nextOffset, h: signature }) : null;

  const saved = new Set(viewer.savedJobIds || []);
  const applied = new Set(viewer.appliedJobIds || []);

  const jobs: FeedJob[] = page.map((entry) => {
    const publicJob = toPublicJob(entry.job);
    const refs = (Array.isArray(entry.job.sources) ? entry.job.sources : []) as JobSourceRef[];
    return {
      ...publicJob,
      matchScore: entry.match.score,
      matchReason: entry.match.reason,
      matchedSkills: entry.match.matchedSkills,
      missingSkills: entry.match.missingSkills,
      recommendation: entry.match.recommendation,
      matchAnalysis: {
        overallMatch: entry.match.score,
        skillsMatch: entry.match.breakdown.skills,
        experienceMatch: entry.match.breakdown.experience,
        educationMatch: 0,
        locationMatch: entry.match.breakdown.location,
        explanation: entry.match.reason,
        matchingSkills: entry.match.matchedSkills,
        missingSkills: entry.match.missingSkills,
        concerns: entry.match.concerns,
        breakdown: { ...entry.match.breakdown },
        recommendation: entry.match.recommendation,
      },
      source: entry.job.source,
      sourceLabel: sourceLabelForProvider(entry.job.provider, entry.job.source),
      sourceUrl: publicJob.sourceUrl,
      applicationUrl: publicJob.applicationUrl,
      officialApplicationUrl:
        resolveOfficialApplicationUrl(entry.job) || publicJob.officialApplicationUrl,
      alternativeSources: refs.map((ref) => ({
        provider: ref.provider,
        sourceUrl: ref.sourceUrl,
        applicationUrl: ref.applicationUrl,
      })),
      isSaved: saved.has(entry.job.id),
      isApplied: applied.has(entry.job.id),
      isSwiped: false,
    };
  });

  return {
    jobs,
    nextCursor,
    total: finalRanked.length,
    meta: {
      candidatesScanned: allJobs.length,
      hardFiltered,
      scored: candidates.length,
      aiReranked: reranked.length,
      diversityCapPerCompany: maxPerCompany,
      weights: getMatchWeights(),
      generatedAt: new Date().toISOString(),
      personalized: Boolean(viewer.profile),
    },
  };
}

/** Deterministic single-job match used by job detail views. */
export function matchForJob(viewer: FeedViewer, job: Job): JobMatchResult | null {
  if (!viewer.profile) return null;
  return rankJobs([job], viewer.profile, viewer.preferences)[0]?.match ?? null;
}
