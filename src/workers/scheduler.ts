import { createLogger } from "@/lib/logger";
import { syncIntervalMinutes } from "@/jobs/ingestion/freshness";
import { runScheduledJobSync } from "./job-sync";
import { runJobExpiration } from "./job-expiration";
import { runJobMatching } from "./job-matching";

const log = createLogger("workers:scheduler");

/**
 * In-process scheduler for the job platform workers.
 *
 * ApplySwipe deploys as a single Next.js server, so the scheduler is a small
 * interval driver rather than a separate cron daemon:
 *
 *   job sync        tick every 15 min, each provider runs when its own interval elapses
 *                   (Adzuna 2h, Greenhouse 6h, Lever 6h - see ingestion/freshness.ts)
 *   expiration      every 12 hours
 *   AI enrichment   every 6 hours
 *
 * The same workers can be triggered externally through
 * `POST /api/cron/jobs/{sync|expire|match}` (CRON_SECRET protected), and by
 * administrators from the admin console. Overlapping runs are prevented by the
 * provider lock, so a cron container and the app can run side by side safely.
 *
 * Disable with JOBS_SCHEDULER_ENABLED=false.
 */

const TICK_INTERVAL_MS = Number(process.env.JOBS_SCHEDULER_TICK_MS || 15 * 60 * 1000);
const EXPIRATION_INTERVAL_MS = Number(process.env.JOBS_EXPIRATION_INTERVAL_MS || 12 * 60 * 60 * 1000);
const MATCHING_INTERVAL_MS = Number(process.env.JOBS_MATCHING_INTERVAL_MS || 6 * 60 * 60 * 1000);

export function isSchedulerEnabled(): boolean {
  if (process.env.JOBS_SCHEDULER_ENABLED === "false") return false;
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return false;
  return true;
}

interface SchedulerState {
  started: boolean;
  timers: NodeJS.Timeout[];
  running: Set<string>;
}

const globalScope = globalThis as unknown as { __APPLYSWIPE_SCHEDULER__?: SchedulerState };

function state(): SchedulerState {
  if (!globalScope.__APPLYSWIPE_SCHEDULER__) {
    globalScope.__APPLYSWIPE_SCHEDULER__ = { started: false, timers: [], running: new Set() };
  }
  return globalScope.__APPLYSWIPE_SCHEDULER__;
}

async function runGuarded(name: string, task: () => Promise<unknown>): Promise<void> {
  const current = state();
  if (current.running.has(name)) {
    log.warn("worker still running - skipping this tick", { worker: name });
    return;
  }

  current.running.add(name);
  try {
    await task();
  } catch (error) {
    log.error("worker failed", { worker: name, error: (error as Error).message });
  } finally {
    current.running.delete(name);
  }
}

/** Runs the sync tick immediately (used by tests/admin tooling). */
export async function tickJobSync(): Promise<void> {
  await runGuarded("job-sync", runScheduledJobSync);
}

/** Starts the worker schedule once per process. Safe to call repeatedly. */
export function startJobScheduler(): boolean {
  if (!isSchedulerEnabled()) {
    log.info("job scheduler disabled", { reason: "JOBS_SCHEDULER_ENABLED=false or test environment" });
    return false;
  }

  const current = state();
  if (current.started) return true;
  current.started = true;

  const syncTimer = setInterval(() => {
    void runGuarded("job-sync", runScheduledJobSync);
  }, TICK_INTERVAL_MS);

  const expirationTimer = setInterval(() => {
    void runGuarded("expiration", () => runJobExpiration());
  }, EXPIRATION_INTERVAL_MS);

  const matchingTimer = setInterval(() => {
    void runGuarded("matching", () => runJobMatching());
  }, MATCHING_INTERVAL_MS);

  current.timers.push(syncTimer, expirationTimer, matchingTimer);
  // Never keep the Node process alive just for the scheduler.
  syncTimer.unref?.();
  expirationTimer.unref?.();
  matchingTimer.unref?.();

  log.info("job scheduler started", {
    tickMinutes: TICK_INTERVAL_MS / 60000,
    expirationHours: EXPIRATION_INTERVAL_MS / 3600000,
    matchingHours: MATCHING_INTERVAL_MS / 3600000,
    providerIntervals: {
      ADZUNA: syncIntervalMinutes("ADZUNA"),
      GREENHOUSE: syncIntervalMinutes("GREENHOUSE"),
      LEVER: syncIntervalMinutes("LEVER"),
    },
  });

  // Kick off an initial (due-only) sync shortly after boot.
  const bootTimer = setTimeout(() => {
    void runGuarded("job-sync", runScheduledJobSync);
  }, Number(process.env.JOBS_SCHEDULER_BOOT_DELAY_MS || 20000));
  bootTimer.unref?.();
  current.timers.push(bootTimer);

  return true;
}

export function stopJobScheduler(): void {
  const current = state();
  for (const timer of current.timers) clearInterval(timer);
  current.timers = [];
  current.started = false;
}

/**
 * Lazily boots the scheduler from an HTTP entry point (feed route, cron route,
 * admin actions). Cheap after the first call and a no-op in tests.
 */
export function ensureWorkersStarted(): void {
  const current = state();
  if (current.started || !isSchedulerEnabled()) return;
  startJobScheduler();
}
