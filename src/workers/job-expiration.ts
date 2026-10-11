import { createLogger } from "@/lib/logger";
import { expireStaleJobs, type ExpireOptions, type ExpireResult } from "@/jobs/ingestion/expire";
import { providerFreshnessSettings } from "@/jobs/ingestion/freshness";

const log = createLogger("workers:job-expiration");

/**
 * Job expiration worker (recommended cadence: every 12 hours).
 *
 * Deactivates jobs that providers stopped returning or that passed their
 * `expiresAt`. Records are never deleted: application tracking, swipes and
 * analytics keep their history, and a job that reappears in a later sync is
 * automatically reactivated by the ingestion upsert.
 */
export async function runJobExpiration(options: ExpireOptions = {}): Promise<ExpireResult> {
  const startedAt = Date.now();
  const result = await expireStaleJobs(options);

  log.info("job expiration finished", {
    evaluated: result.evaluated,
    deactivated: result.deactivated,
    expired: result.expired,
    notSeen: result.notSeen,
    durationMs: Date.now() - startedAt,
    freshness: providerFreshnessSettings(),
  });

  return result;
}

export { expireStaleJobs };
