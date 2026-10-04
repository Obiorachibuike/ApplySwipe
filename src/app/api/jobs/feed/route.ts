import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/jwt";
import { createLogger } from "@/lib/logger";
import { FEED_RATE_LIMIT, checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getFeed, loadViewer } from "@/jobs/services/feed-service";
import { ensureWorkersStarted } from "@/workers/scheduler";

export const dynamic = "force-dynamic";

const log = createLogger("api:jobs:feed");

/**
 * GET /api/jobs/feed
 *
 * Personalized, database-driven job feed:
 *   1. authenticate the user
 *   2. load profile + preferences
 *   3. load active jobs (never provider APIs)
 *   4. exclude passed / liked / applied / saved jobs
 *   5. hard filters -> deterministic scoring -> diversity -> AI re-rank (top slice)
 *   6. cursor paginated response
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rate = checkRateLimit(`feed:${user.id}`, FEED_RATE_LIMIT);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many feed requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rate) }
      );
    }

    ensureWorkersStarted();

    const viewer = await loadViewer(user.id);

    const feed = await getFeed(viewer, {
      cursor: searchParams.get("cursor"),
      limit: Number(searchParams.get("limit")) || undefined,
      remote: searchParams.get("remote") === "true" ? true : undefined,
      minScore: searchParams.get("minScore") ? Number(searchParams.get("minScore")) : undefined,
      employmentType: searchParams.get("employmentType") || undefined,
      provider: searchParams.get("provider") || undefined,
      query: searchParams.get("query") || undefined,
      location: searchParams.get("location") || undefined,
      includeSaved: searchParams.get("includeSaved") === "true",
      maxPerCompany: searchParams.get("maxPerCompany") ? Number(searchParams.get("maxPerCompany")) : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        ...feed,
      },
      { headers: rateLimitHeaders(rate) }
    );
  } catch (error) {
    log.error("feed request failed", { error: (error as Error).message });
    return NextResponse.json({ error: "Failed to build job feed" }, { status: 500 });
  }
}
