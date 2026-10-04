import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/jwt";
import db from "@/lib/db";
import { duplicateStats, jobCounts } from "@/jobs/services/job-service";
import { providerHealthReport } from "@/jobs/ingestion/provider-state";

export async function GET() {
  try {
    await requireAdmin();

    const [usersCount, jobsCount, appsCount, sourcesCount, aiUsages] = await Promise.all([
      db.user.count(),
      db.job.count(),
      db.application.count(),
      db.jobSource.count(),
      db.aiUsage.findMany(),
    ]);

    const totalInputTokens = aiUsages.reduce((acc: number, u: any) => acc + (u.inputTokens || 0), 0);
    const totalOutputTokens = aiUsages.reduce((acc: number, u: any) => acc + (u.outputTokens || 0), 0);
    const totalEstimatedCost = aiUsages.reduce((acc: number, u: any) => acc + (u.estimatedCost || 0), 0);

    const reportedJobsCount = await db.job.count({ where: { isReported: true } });

    return NextResponse.json({
      success: true,
      stats: {
        usersCount,
        jobsCount,
        appsCount,
        sourcesCount,
        reportedJobsCount,
        ai: {
          totalCalls: aiUsages.length,
          totalInputTokens,
          totalOutputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
          totalEstimatedCost: Number(totalEstimatedCost.toFixed(4)),
        },
        systemHealth: {
          database: "CONNECTED",
          aiEngine: "HEALTHY",
          queueWorker: "RUNNING",
          automationAdapter: "READY",
          jobScheduler:
            process.env.JOBS_SCHEDULER_ENABLED === "false" ? "DISABLED" : "RUNNING",
          providers: (await providerHealthReport()).map((provider) => ({
            provider: provider.provider,
            status: provider.status,
            lastSyncAt: provider.lastSyncAt,
          })),
        },
        jobPlatform: {
          ...(await jobCounts()),
          duplicates: await duplicateStats(),
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 });
  }
}
