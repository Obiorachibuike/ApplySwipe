import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { runJobSync } from "@/workers/job-sync";
import { runJobExpiration } from "@/workers/job-expiration";
import { runJobMatching } from "@/workers/job-matching";
import { ensureWorkersStarted } from "@/workers/scheduler";

export const dynamic = "force-dynamic";

const log = createLogger("api:cron:jobs");

const TASKS = ["sync", "expire", "match"] as const;
type Task = (typeof TASKS)[number];

/**
 * External cron entry point.
 *
 *   POST /api/cron/jobs/sync    - ingest every configured provider
 *   POST /api/cron/jobs/expire  - freshness sweep (deactivate stale jobs)
 *   POST /api/cron/jobs/match   - precompute match scores + skill enrichment
 *
 * Protected by the CRON_SECRET header so it can be called by any scheduler
 * (Vercel Cron, GitHub Actions, Kubernetes CronJob, systemd timer):
 *   Authorization: Bearer $CRON_SECRET   or   x-cron-secret: $CRON_SECRET
 *
 * GET reports the worker schedule state without running anything.
 */
export async function POST(req: Request, { params }: { params: { task: string } }) {
  const task = params.task as Task;
  if (!TASKS.includes(task)) {
    return NextResponse.json({ error: `Unknown task. Supported: ${TASKS.join(", ")}` }, { status: 404 });
  }

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const provided = header || req.headers.get("x-cron-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production" && process.env.JOBS_ALLOW_UNPROTECTED_CRON !== "true") {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured - refusing to run unprotected cron tasks" },
      { status: 503 }
    );
  }

  try {
    ensureWorkersStarted();

    if (task === "sync") {
      const summary = await runJobSync({ triggeredBy: "cron" });
      return NextResponse.json({ success: true, task, summary });
    }

    if (task === "expire") {
      const result = await runJobExpiration();
      return NextResponse.json({ success: true, task, result });
    }

    const summary = await runJobMatching();
    return NextResponse.json({ success: true, task, summary });
  } catch (error: any) {
    log.error("cron task failed", { task, error: error?.message });
    return NextResponse.json({ error: error?.message || "Cron task failed" }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: { task: string } }) {
  if (!TASKS.includes(params.task as Task)) {
    return NextResponse.json({ error: `Unknown task. Supported: ${TASKS.join(", ")}` }, { status: 404 });
  }
  const { isProviderDue } = await import("@/jobs/ingestion/freshness");
  const { providerHealthReport } = await import("@/jobs/ingestion/provider-state");
  const report = await providerHealthReport();

  return NextResponse.json({
    success: true,
    task: params.task,
    protected: Boolean(process.env.CRON_SECRET),
    scheduled: process.env.JOBS_SCHEDULER_ENABLED !== "false",
    providers: report.map((entry) => ({
      provider: entry.provider,
      status: entry.status,
      lastSyncAt: entry.lastSyncAt,
      due: isProviderDue(entry.provider, entry.lastSyncAt),
      syncIntervalMinutes: entry.syncIntervalMinutes,
    })),
  });
}
