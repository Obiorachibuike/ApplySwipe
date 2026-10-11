import { createLogger } from "@/lib/logger";
import { listProviders } from "@/jobs/providers";
import {
  ingestAllProviders,
  ingestProvider,
  summarizeStats,
  type IngestOptions,
  type IngestStats,
} from "@/jobs/ingestion/ingest";
import { getProviderState } from "@/jobs/ingestion/provider-state";
import { isProviderDue } from "@/jobs/ingestion/freshness";

const log = createLogger("workers:job-sync");

/**
 * Job sync worker.
 *
 * Recommended schedule (see ./scheduler.ts):
 *   Adzuna     every 2 hours
 *   Greenhouse every 6 hours
 *   Lever      every 6 hours
 *
 * The worker never runs a full sync inside a user HTTP request and never allows
 * two runs for the same provider (provider lock + in-process guard).
 */

export interface SyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  triggeredBy: string;
  providers: IngestStats[];
  totals: {
    fetched: number;
    inserted: number;
    updated: number;
    duplicates: number;
    failed: number;
    deactivated: number;
  };
}

export interface RunJobSyncOptions extends IngestOptions {
  /** Restrict the run to specific providers (admin "sync now"). */
  providers?: string[];
  /** Skip providers whose sync interval has not elapsed yet (scheduler mode). */
  onlyDue?: boolean;
}

/** Runs a sync for the requested providers (defaults to all). */
export async function runJobSync(options: RunJobSyncOptions = {}): Promise<SyncSummary> {
  const startedAt = new Date();
  const triggeredBy = options.triggeredBy || "manual";
  const providers = (options.providers?.length ? options.providers : listProviders()).map((provider) =>
    String(provider).toUpperCase()
  );

  log.info("job sync starting", { providers, triggeredBy, onlyDue: options.onlyDue || false });

  const results: IngestStats[] = [];

  for (const provider of providers) {
    try {
      if (options.onlyDue) {
        const state = await getProviderState(provider);
        if (!state.isEnabled) {
          log.info("provider disabled - skipping", { provider });
          continue;
        }
        if (!isProviderDue(provider, state.lastSyncAt)) {
          log.debug("provider not due yet", { provider, lastSyncAt: state.lastSyncAt });
          continue;
        }
      }

      const stats = await ingestProvider(provider, options);
      results.push(stats);
      log.info("provider sync finished", summarizeStats(stats));
    } catch (error) {
      // ingestProvider traps its own errors; this keeps the loop alive regardless.
      log.error("provider sync crashed", { provider, error: (error as Error).message });
      results.push({
        provider,
        status: "FAILED",
        fetched: 0,
        inserted: 0,
        updated: 0,
        duplicates: 0,
        failed: 1,
        deactivated: 0,
        sourcesProcessed: 0,
        sourcesFailed: 1,
        errors: [{ message: (error as Error).message }],
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 0,
      });
    }
  }

  const totals = results.reduce(
    (acc, stats) => ({
      fetched: acc.fetched + stats.fetched,
      inserted: acc.inserted + stats.inserted,
      updated: acc.updated + stats.updated,
      duplicates: acc.duplicates + stats.duplicates,
      failed: acc.failed + stats.failed,
      deactivated: acc.deactivated + stats.deactivated,
    }),
    { fetched: 0, inserted: 0, updated: 0, duplicates: 0, failed: 0, deactivated: 0 }
  );

  const finishedAt = new Date();

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    triggeredBy,
    providers: results,
    totals,
  };
}

/** Scheduler entry point: syncs only the providers whose interval elapsed. */
export async function runScheduledJobSync(): Promise<SyncSummary> {
  return runJobSync({ triggeredBy: "scheduler", onlyDue: true });
}

/** Convenience wrapper used by the CLI and the cron endpoint. */
export async function runFullSync(triggeredBy = "manual"): Promise<SyncSummary> {
  return runJobSync({ triggeredBy });
}

export { ingestAllProviders };
