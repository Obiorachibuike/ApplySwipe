import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/jwt";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { duplicateStats, resolveOfficialApplicationUrl, sourceLabelForProvider } from "@/jobs/services/job-service";
import { reactivateJob } from "@/jobs/ingestion/expire";
import { sanitizeJobSource } from "@/jobs/services/provider-service";
import type { Job, JobSourceRef } from "@/types";

export const dynamic = "force-dynamic";

const log = createLogger("api:admin:jobs");

/**
 * GET /api/admin/jobs
 *   ?provider=ADZUNA      filter by provider
 *   ?status=active|inactive|merged
 *   ?jobId=...            inspect one job, including its source metadata
 *   ?limit=100            page size (max 500)
 *
 * Admin job management: counts, duplicate rates, per-job source inspection.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider")?.toUpperCase();
    const status = searchParams.get("status");
    const jobId = searchParams.get("jobId");
    const limit = Math.min(500, Number(searchParams.get("limit")) || 200);

    if (jobId) {
      const job = (await db.job.findUnique({ where: { id: jobId } })) as Job | null;
      if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

      const canonical = job.canonicalJobId
        ? ((await db.job.findUnique({ where: { id: job.canonicalJobId } })) as Job | null)
        : null;

      return NextResponse.json({
        success: true,
        job: { ...job, sourceLabel: sourceLabelForProvider(job.provider, job.source) },
        officialApplicationUrl: resolveOfficialApplicationUrl(job),
        canonicalJob: canonical,
        sources: (Array.isArray(job.sources) ? job.sources : []) as JobSourceRef[],
      });
    }

    const where: Record<string, unknown> = {};
    if (provider) where.provider = provider;

    const allJobs = (await db.job.findMany({ where, orderBy: { postedAt: "desc" } })) as Job[];

    const filtered = allJobs.filter((job) => {
      if (status === "active") return job.isActive && !job.canonicalJobId;
      if (status === "inactive") return !job.isActive;
      if (status === "merged") return Boolean(job.canonicalJobId);
      if (status === "reported") return Boolean(job.isReported);
      return true;
    });

    const jobs = filtered.slice(0, limit).map((job) => ({
      ...job,
      sourceLabel: sourceLabelForProvider(job.provider, job.source),
      officialApplicationUrl: resolveOfficialApplicationUrl(job),
    }));

    return NextResponse.json({
      success: true,
      jobs,
      total: filtered.length,
      diagnostics: await duplicateStats(),
      providers: Array.from(new Set(allJobs.map((job) => job.provider || "LEGACY"))),
    });
  } catch (error: any) {
    const status = error?.message === "Unauthorized" ? 401 : 403;
    return NextResponse.json({ error: error?.message || "Unauthorized" }, { status });
  }
}

/**
 * PATCH /api/admin/jobs
 * Body: { jobId, isActive?, isReported? }
 * Deactivate/reactivate problematic jobs; reactivation also refreshes freshness.
 */
export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const { jobId, isActive, isReported } = await req.json();

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    if (isActive === true) {
      const job = await reactivateJob(jobId);
      return NextResponse.json({ success: true, job });
    }

    const updated = (await db.job.update({
      where: { id: jobId },
      data: {
        ...(isActive !== undefined ? { isActive } : {}),
        ...(isReported !== undefined ? { isReported } : {}),
      },
    })) as Job;

    return NextResponse.json({ success: true, job: updated });
  } catch (error: any) {
    log.warn("failed to update job", { error: error?.message });
    const status = error?.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error?.message || "Failed to update job" }, { status });
  }
}

/** POST /api/admin/jobs { sourceId } - inspect a configured source (sanitized). */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const source = await db.jobSource.findUnique({ where: { id: body?.sourceId } });
    if (!source) return NextResponse.json({ error: "Job source not found" }, { status: 404 });
    return NextResponse.json({ success: true, source: sanitizeJobSource(source) });
  } catch (error: any) {
    const status = error?.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error?.message || "Failed to load source" }, { status });
  }
}
