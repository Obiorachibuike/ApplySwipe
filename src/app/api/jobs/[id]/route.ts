import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/jwt";
import db from "@/lib/db";
import { matchForJob } from "@/jobs/services/feed-service";
import { recordJobView, resolveOfficialApplicationUrl, sourceLabelForProvider, toPublicJob } from "@/jobs/services/job-service";
import type { Job, Profile, UserPreference } from "@/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/:id
 *
 * Job detail from the normalized database, with the deterministic match score
 * (no LLM call per page view) and the resolved official application URL.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const job = (await db.job.findUnique({ where: { id: params.id } })) as Job | null;

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const user = await getSessionUser();
    let match = null;
    let isSaved = false;
    let isApplied = false;
    let isPassed = false;
    let isSuperLiked = false;
    let application = null;

    if (user) {
      const profile = (await db.profile.findUnique({
        where: { userId: user.id },
        include: { skills: true, experiences: true, educations: true, projects: true, certifications: true },
      })) as Profile | null;
      const preferences = (await db.userPreference.findUnique({ where: { userId: user.id } })) as UserPreference | null;

      if (profile) {
        match = matchForJob({ userId: user.id, profile, preferences }, job);
      }

      const saved = await db.savedJob.findFirst({ where: { userId: user.id, jobId: job.id } });
      isSaved = Boolean(saved);

      application = await db.application.findFirst({
        where: { userId: user.id, jobId: job.id },
        include: { answers: true, documents: true, events: true },
      });
      isApplied = Boolean(application);

      const passed = await db.jobInteraction.findFirst({
        where: { userId: user.id, jobId: job.id, interactionType: "PASSED" },
      });
      isPassed = Boolean(passed);

      const superLiked = await db.jobInteraction.findFirst({
        where: { userId: user.id, jobId: job.id, interactionType: "SUPER_LIKE" },
      });
      isSuperLiked = Boolean(superLiked);

      await recordJobView(user.id, job.id).catch(() => undefined);
    }

    const publicJob = toPublicJob(job);

    return NextResponse.json({
      job: {
        ...publicJob,
        matchScore: match?.score ?? null,
        matchReason: match?.reason ?? null,
        matchedSkills: match?.matchedSkills ?? [],
        missingSkills: match?.missingSkills ?? [],
        recommendation: match?.recommendation ?? null,
        matchAnalysis: match
          ? {
              overallMatch: match.score,
              skillsMatch: match.breakdown.skills,
              experienceMatch: match.breakdown.experience,
              educationMatch: 0,
              locationMatch: match.breakdown.location,
              explanation: match.reason,
              matchingSkills: match.matchedSkills,
              missingSkills: match.missingSkills,
              concerns: match.concerns,
              breakdown: match.breakdown,
              recommendation: match.recommendation,
            }
          : null,
        officialApplicationUrl: resolveOfficialApplicationUrl(job),
        sourceLabel: sourceLabelForProvider(job.provider, job.source),
        isSaved,
        isApplied,
        isPassed,
        isSuperLiked,
        application,
      },
    });
  } catch (error: any) {
    console.error("Error fetching job:", error);
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}
