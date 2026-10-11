/**
 * Standalone worker process for deployments that prefer a dedicated container
 * over the in-process scheduler (set JOBS_SCHEDULER_ENABLED=false on web nodes).
 *
 *   npm run workers
 *
 * It runs the same workers as the in-process scheduler, protected by the same
 * provider lock, so running both is safe (the second run is skipped).
 */
import { startJobScheduler, stopJobScheduler } from "@/workers/scheduler";
import { createLogger } from "@/lib/logger";

const log = createLogger("scripts:workers");

process.env.JOBS_SCHEDULER_ENABLED = process.env.JOBS_SCHEDULER_ENABLED || "true";

const started = startJobScheduler();

if (!started) {
  console.error("Worker scheduler did not start (check JOBS_SCHEDULER_ENABLED / NODE_ENV).");
  process.exit(1);
}

log.info("worker process running - press Ctrl+C to stop");

const shutdown = (signal: string) => {
  log.info("shutting down worker process", { signal });
  stopJobScheduler();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
