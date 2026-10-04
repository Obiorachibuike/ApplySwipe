import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/jwt";
import db from "@/lib/db";
import { AIService } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query")?.toLowerCase();
    const role = searchParams.get("role")?.toLowerCase();
    const skill = searchParams.get("skill")?.toLowerCase();
    const location = searchParams.get("location")?.toLowerCase();
    const remoteOnly = searchParams.get("remote") === "true";
    const salaryMin = searchParams.get("salaryMin") ? Number(searchParams.get("salaryMin")) : undefined;
    const minMatch = searchParams.get("minMatch") ? Number(searchParams.get("minMatch")) : undefined;
    const filterStatus = searchParams.get("status"); // unapplied, saved, applied
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Number(searchParams.get("limit")) || 20);

    const user = await getSessionUser();
    let profile: any = null;
    let userInteractions: any[] = [];
    let savedJobIds = new Set<string>();
    let appliedJobIds = new Set<string>();
    let passedJobIds = new Set<string>();

    if (user) {
      profile = await db.profile.findUnique({
        where: { userId: user.id },
        include: { skills: true, experiences: true, educations: true, projects: true },
      });
      userInteractions = await db.jobInteraction.findMany({ where: { userId: user.id } });
      const saved = await db.savedJob.findMany({ where: { userId: user.id } });
      const apps = await db.application.findMany({ where: { userId: user.id } });

      saved.forEach((s: any) => savedJobIds.add(s.jobId));
      apps.forEach((a: any) => appliedJobIds.add(a.jobId));
      userInteractions
        .filter((i: any) => i.interactionType === "PASSED")
        .forEach((i: any) => passedJobIds.add(i.jobId));
    }

    let jobs = await db.job.findMany({
      where: { isActive: true },
      orderBy: { postedAt: "desc" },
    });

    // Apply filtering
    if (query) {
      jobs = jobs.filter(
        (j: any) =>
          j.title.toLowerCase().includes(query) ||
          j.company.toLowerCase().includes(query) ||
          j.description.toLowerCase().includes(query)
      );
    }

    if (role) {
      jobs = jobs.filter((j: any) => j.title.toLowerCase().includes(role));
    }

    if (skill) {
      jobs = jobs.filter((j: any) =>
        (j.skills || []).some((s: string) => s.toLowerCase().includes(skill))
      );
    }

    if (location) {
      jobs = jobs.filter((j: any) => j.location.toLowerCase().includes(location));
    }

    if (remoteOnly) {
      jobs = jobs.filter((j: any) => Boolean(j.remote));
    }

    if (salaryMin) {
      jobs = jobs.filter((j: any) => !j.salaryMax || j.salaryMax >= salaryMin);
    }

    // Attach user status and compute AI match
    let enrichedJobs = await Promise.all(
      jobs.map(async (job: any) => {
        let matchScore = 80;
        let matchAnalysis: any = null;

        if (profile) {
          const analysis = await AIService.analyzeMatch(profile, job);
          matchScore = analysis.result.overallMatch;
          matchAnalysis = analysis.result;
        }

        const isSaved = savedJobIds.has(job.id);
        const isApplied = appliedJobIds.has(job.id);
        const isPassed = passedJobIds.has(job.id);

        return {
          ...job,
          matchScore,
          matchAnalysis,
          isSaved,
          isApplied,
          isPassed,
        };
      })
    );

    // Filter by minMatch
    if (minMatch) {
      enrichedJobs = enrichedJobs.filter((j) => j.matchScore >= minMatch);
    }

    // Filter by status if requested (e.g. unapplied for Discover swiper)
    if (filterStatus === "unapplied") {
      enrichedJobs = enrichedJobs.filter((j) => !j.isApplied && !j.isPassed);
    } else if (filterStatus === "saved") {
      enrichedJobs = enrichedJobs.filter((j) => j.isSaved);
    } else if (filterStatus === "applied") {
      enrichedJobs = enrichedJobs.filter((j) => j.isApplied);
    }

    const total = enrichedJobs.length;
    const startIndex = (page - 1) * limit;
    const paginated = enrichedJobs.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      jobs: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("Error in GET /api/jobs:", error);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}
