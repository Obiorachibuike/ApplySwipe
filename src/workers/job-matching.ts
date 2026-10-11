import db from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { Job, Profile, User } from "@/types";
import { getFeed, loadViewer } from "@/jobs/services/feed-service";
import { AI_RERANK_ENABLED, AI_RERANK_TOP, pruneMatchScores } from "@/jobs/matching/ai-rerank";
import { jobSkills } from "@/jobs/matching/score";
import { extractSkills } from "@/jobs/matching/skills";
import { buildSearchText } from "@/jobs/ingestion/ingest";

const log = createLogger("workers:job-matching");

/**
 * Job matching worker (recommended cadence: every 6 hours).
 *
 * 1. Precomputes and caches match scores for active users so the swipe feed and
 *    job detail views stay database-driven instead of recomputing (or worse,
 *    calling an LLM) on every request.
 * 2. Enriches stored jobs that have no extracted skills yet - deterministic
 *    extraction only, no LLM call per job.
 */

export interface MatchingRunSummary {
  usersProcessed: number;
  jobsScored: number;
  jobsEnriched: number;
  prunedScores: number;
  durationMs: number;
  aiRerankEnabled: boolean;
}

export async function runJobMatching(options: { maxUsers?: number; userIds?: string[] } = {}): Promise<MatchingRunSummary> {
  const startedAt = Date.now();
  const maxUsers = options.maxUsers ?? 100;

  const users = options.userIds?.length
    ? ((await db.user.findMany({ where: { role: "USER" } })) as User[]).filter((user) =>
        options.userIds!.includes(user.id)
      )
    : ((await db.user.findMany({ where: { role: "USER" } })) as User[]).slice(0, maxUsers);

  let usersProcessed = 0;
  let jobsScored = 0;

  for (const user of users) {
    try {
      const viewer = await loadViewer(user.id);
      if (!viewer.profile) continue;

      // Reuses the exact feed pipeline (hard filters + ranking + AI re-rank),
      // but does not return the page to anyone - it warms `JobMatchScore`.
      const feed = await getFeed(viewer, { limit: AI_RERANK_TOP || 20 });
      usersProcessed += 1;
      jobsScored += feed.jobs.length;
    } catch (error) {
      log.warn("matching run failed for user", { userId: user.id, error: (error as Error).message });
    }
  }

  const jobsEnriched = await enrichJobsMissingSkills();
  const prunedScores = await pruneMatchScores(undefined, Number(process.env.JOB_MATCH_KEEP_PER_USER || 400));

  const summary: MatchingRunSummary = {
    usersProcessed,
    jobsScored,
    jobsEnriched,
    prunedScores,
    durationMs: Date.now() - startedAt,
    aiRerankEnabled: AI_RERANK_ENABLED,
  };

  log.info("job matching finished", { ...summary } as Record<string, unknown>);
  return summary;
}

/**
 * Fills in skills for jobs where the provider gave us nothing usable.
 * Deterministic extraction over title + description + stored raw payload.
 */
export async function enrichJobsMissingSkills(limit = 200): Promise<number> {
  const jobs = (await db.job.findMany({ where: { isActive: true }, orderBy: { lastSeenAt: "desc" } })) as Job[];
  let enriched = 0;

  for (const job of jobs) {
    if (enriched >= limit) break;
    if (jobSkills(job).length > 0) continue;

    const raw = job.rawData && typeof job.rawData === "object" ? JSON.stringify(job.rawData).slice(0, 4000) : "";
    const text = `${job.title}\n${job.company}\n${job.description || ""}\n${raw}`;
    const skills = extractSkills(text, { limit: 20 });

    if (skills.length === 0) continue;

    await db.job.update({
      where: { id: job.id },
      data: {
        skills,
        searchText: buildSearchText({
          title: job.title,
          company: job.company,
          location: job.location,
          skills,
          employmentType: job.employmentType,
          workplaceType: job.workplaceType,
        }),
      },
    });
    enriched += 1;
  }

  return enriched;
}

export { getFeed };

export function profileDigest(profile: Profile | null) {
  if (!profile) return null;
  return {
    id: profile.id,
    headline: profile.headline || null,
    level: profile.experienceLevel || null,
    skills: (profile.skills || []).map((skill) => skill.name),
    years: (profile.experiences || []).length,
  };
}
