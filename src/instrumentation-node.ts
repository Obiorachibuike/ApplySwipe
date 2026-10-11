import { createLogger } from "@/lib/logger";

const log = createLogger("instrumentation");

/**
 * Node-runtime half of the Next.js instrumentation hook.
 *
 * Kept in its own module so the edge compiler never has to resolve the worker
 * graph (it imports `fs`/`crypto` through the database layer). Next.js replaces
 * `process.env.NEXT_RUNTIME` at build time, so the edge bundle drops the
 * `import("./instrumentation-node")` branch entirely.
 */
export async function registerNodeInstrumentation(): Promise<void> {
  try {
    const { startJobScheduler } = await import("@/workers/scheduler");
    startJobScheduler();
    log.info("job scheduler booted with the server process");
  } catch (error) {
    // Never block server startup because of the scheduler: the cron endpoints
    // and `npm run workers` remain available either way.
    log.warn("job scheduler failed to start", { error: (error as Error).message });
  }
}
