/**
 * Next.js instrumentation hook.
 *
 * Starts the job platform workers (provider sync, freshness sweep, match
 * precomputation) once per server process. The Node-only half lives in
 * `instrumentation-node.ts` so the edge bundle never resolves the worker graph.
 *
 * Disable with JOBS_SCHEDULER_ENABLED=false and drive the workers through the
 * `/api/cron/jobs/*` endpoints or `npm run workers` instead.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNodeInstrumentation } = await import("./instrumentation-node");
    await registerNodeInstrumentation();
  }
}
