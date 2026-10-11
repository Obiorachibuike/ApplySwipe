import db from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { Job } from "@/types";
import { staleReason } from "./freshness";

const log = createLogger("jobs:expire");

export interface ExpireOptions {
  now?: Date;
  dryRun?: boolean;
  /** Only evaluate a subset of providers (admin action). */
  providers?: string[];
  /** Maximum number of jobs to deactivate in one sweep (safety valve). */
  limit?: number;
}

export interface ExpireResult {
  evaluated: number;
  deactivated: number;
  expired: number;
  notSeen: number;
  byProvider: Record<string, number>;
  dryRun: boolean;
  deactivatedJobIds: string[];
}

/**
 * Freshness sweep.
 *
 * Jobs are never deleted: they are flagged `isActive = false` so swipes,
 * applications, resume versions and analytics keep working. Jobs that a
 * provider returns again during a later sync are automatically reactivated by
 * the ingestion upsert.
 */
export async function expireStaleJobs(options: ExpireOptions = {}): Promise<ExpireResult> {
  const now = options.now || new Date();
  const dryRun = options.dryRun === true;
  const providers = options.providers?.map((p) => p.toUpperCase());
  const limit = options.limit ?? 5000;

  const where: Record<string, unknown> = { isActive: true };
  if (providers && providers.length === 1) where.provider = providers[0];

  const jobs = (await db.job.findMany({ where })) as Job[];

  const result: ExpireResult = {
    evaluated: 0,
    deactivated: 0,
    expired: 0,
    notSeen: 0,
    byProvider: {},
    dryRun,
    deactivatedJobIds: [],
  };

  for (const job of jobs) {
    const provider = String(job.provider || "LEGACY").toUpperCase();
    if (providers && providers.length > 0 && !providers.includes(provider)) continue;
    if (job.canonicalJobId) continue;

    result.evaluated += 1;
    const reason = staleReason(job, now);
    if (!reason) continue;

    // Jobs referenced by an in-flight application stay visible until the user's
    // own application reaches a terminal state (history is never lost either way).
    const inFlightApplication = await db.application.findFirst({
      where: { jobId: job.id, status: { in: ["SUBMITTED", "APPLIED", "INTERVIEW", "OFFER"] } },
    });
    if (inFlightApplication) continue;

    if (result.deactivated >= limit) break;

    if (reason === "EXPIRED") result.expired += 1;
    else result.notSeen += 1;

    if (!dryRun) {
      await db.job.update({ where: { id: job.id }, data: { isActive: false } });
    }

    result.deactivated += 1;
    result.byProvider[provider] = (result.byProvider[provider] || 0) + 1;
    result.deactivatedJobIds.push(job.id);
  }

  if (result.deactivated > 0) {
    log.info("freshness sweep complete", {
      deactivated: result.deactivated,
      expired: result.expired,
      notSeen: result.notSeen,
      dryRun,
    });
  }

  return result;
}

/** Admin action: bring a job back into the feed. */
export async function reactivateJob(jobId: string): Promise<Job | null> {
  const job = (await db.job.findUnique({ where: { id: jobId } })) as Job | null;
  if (!job) return null;
  if (job.canonicalJobId) return job;
  return (await db.job.update({
    where: { id: jobId },
    data: {
      isActive: true,
      lastSeenAt: new Date().toISOString(),
    },
  })) as Job;
}
