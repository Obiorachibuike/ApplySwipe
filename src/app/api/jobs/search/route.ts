import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/jwt";
import { createLogger } from "@/lib/logger";
import { SEARCH_RATE_LIMIT, checkRateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";
import db from "@/lib/db";
import { searchJobs } from "@/jobs/services/job-service";
import type { Profile, UserPreference } from "@/types";

export const dynamic = "force-dynamic";

const log = createLogger("api:jobs:search");

/**
 * GET /api/jobs/search
 *
 * Searches ApplySwipe's normalized job database - no external provider is
 * queried per page load. Supported filters:
 *   query, location, remote, employmentType, seniority, salaryMin, salaryMax,
 *   skills, provider + page/limit pagination.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  try {
    const user = await getSessionUser();
    const rate = checkRateLimit(`search:${user?.id || clientKey(req)}`, SEARCH_RATE_LIMIT);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many search requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rate) }
      );
    }

    let profile: Profile | null = null;
    let preferences: UserPreference | null = null;
    if (user) {
      profile = (await db.profile.findUnique({
        where: { userId: user.id },
        include: { skills: true, experiences: true, educations: true, projects: true },
      })) as Profile | null;
      preferences = (await db.userPreference.findUnique({ where: { userId: user.id } })) as UserPreference | null;
    }

    const skillsParam = searchParams.get("skills");
    const skills = skillsParam
      ? skillsParam
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean)
      : undefined;

    const result = await searchJobs(
      {
        query: searchParams.get("query") || undefined,
        location: searchParams.get("location") || undefined,
        remote: searchParams.get("remote") === "true" ? true : undefined,
        workplaceType: searchParams.get("workplaceType") || undefined,
        employmentType: searchParams.get("employmentType") || undefined,
        seniority: searchParams.get("seniority") || undefined,
        salaryMin: searchParams.get("salaryMin") ? Number(searchParams.get("salaryMin")) : undefined,
        salaryMax: searchParams.get("salaryMax") ? Number(searchParams.get("salaryMax")) : undefined,
        provider: searchParams.get("provider") || undefined,
        company: searchParams.get("company") || undefined,
        skills,
      },
      {
        page: Number(searchParams.get("page")) || 1,
        limit: Number(searchParams.get("limit")) || 20,
        viewerProfile: profile,
        viewerPreferences: preferences,
      }
    );

    return NextResponse.json(
      {
        success: true,
        ...result,
        filters: {
          query: searchParams.get("query"),
          location: searchParams.get("location"),
          remote: searchParams.get("remote") === "true",
          employmentType: searchParams.get("employmentType"),
          seniority: searchParams.get("seniority"),
          salaryMin: searchParams.get("salaryMin"),
          provider: searchParams.get("provider"),
          skills: skills || [],
        },
      },
      { headers: rateLimitHeaders(rate) }
    );
  } catch (error) {
    log.error("job search failed", { error: (error as Error).message });
    return NextResponse.json({ error: "Failed to search jobs" }, { status: 500 });
  }
}
