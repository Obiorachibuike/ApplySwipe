import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/jwt";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { SEARCH_RATE_LIMIT, checkRateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";
import { searchJobs } from "@/jobs/services/job-service";
import type { Job, JobInteraction, Profile, UserPreference } from "@/types";

export const dynamic = "force-dynamic";

const log = createLogger("api:jobs");

/**
 * GET /api/jobs
 *
 * Backwards compatible job listing (used by the dashboard) backed by the
 * normalized ApplySwipe database. The personalized swipe queue lives at
 * `/api/jobs/feed`; both never call a provider API.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const user = await getSessionUser();

    const rate = checkRateLimit(`jobs:${user?.id || clientKey(req)}`, SEARCH_RATE_LIMIT);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rate) }
      );
    }

    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Number(searchParams.get("limit")) || 20);
    const minMatch = searchParams.get("minMatch") ? Number(searchParams.get("minMatch")) : undefined;
    const filterStatus = searchParams.get("status");

    let profile: Profile | null = null;
    let preferences: UserPreference | null = null;
    let savedJobIds = new Set<string>();
    let appliedJobIds = new Set<string>();
    let passedJobIds = new Set<string>();

    if (user) {
      profile = (await db.profile.findUnique({
        where: { userId: user.id },
        include: { skills: true, experiences: true, educations: true, projects: true },
      })) as Profile | null;
      preferences = (await db.userPreference.findUnique({ where: { userId: user.id } })) as UserPreference | null;

      const [saved, applications, interactions] = await Promise.all([
        db.savedJob.findMany({ where: { userId: user.id } }),
        db.application.findMany({ where: { userId: user.id } }),
        db.jobInteraction.findMany({ where: { userId: user.id } }),
      ]);

      savedJobIds = new Set(saved.map((entry: { jobId: string }) => entry.jobId));
      appliedJobIds = new Set(applications.map((entry: { jobId: string }) => entry.jobId));
      passedJobIds = new Set(
        (interactions as JobInteraction[])
          .filter((interaction) => interaction.interactionType === "PASSED")
          .map((interaction) => interaction.jobId)
      );
    }

    const result = await searchJobs(
      {
        query: searchParams.get("query") || searchParams.get("role") || undefined,
        location: searchParams.get("location") || undefined,
        remote: searchParams.get("remote") === "true" ? true : undefined,
        employmentType: searchParams.get("employmentType") || undefined,
        seniority: searchParams.get("seniority") || undefined,
        provider: searchParams.get("provider") || undefined,
        skills: searchParams.get("skill") ? [searchParams.get("skill") as string] : undefined,
        salaryMin: searchParams.get("salaryMin") ? Number(searchParams.get("salaryMin")) : undefined,
      },
      { page, limit, viewerProfile: profile, viewerPreferences: preferences }
    );

    let jobs = result.jobs.map((job) => ({
      ...job,
      isSaved: savedJobIds.has(job.id),
      isApplied: appliedJobIds.has(job.id),
      isPassed: passedJobIds.has(job.id),
    }));

    if (minMatch) jobs = jobs.filter((job) => (job.matchScore || 0) >= minMatch);

    if (filterStatus === "unapplied") {
      jobs = jobs.filter((job) => !job.isApplied && !job.isPassed);
    } else if (filterStatus === "saved") {
      jobs = jobs.filter((job) => job.isSaved);
    } else if (filterStatus === "applied") {
      jobs = jobs.filter((job) => job.isApplied);
    }

    return NextResponse.json(
      {
        jobs,
        total: filterStatus || minMatch ? jobs.length : result.total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil((filterStatus || minMatch ? jobs.length : result.total) / limit)),
        scanned: result.scanned,
      },
      { headers: rateLimitHeaders(rate) }
    );
  } catch (error: any) {
    log.error("GET /api/jobs failed", { error: error?.message });
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}

export type { Job };
