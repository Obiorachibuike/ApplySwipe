import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/jwt";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { prepareApplication, recordSwipe } from "@/jobs/services/application-service";
import type { ApplicationMode, Job } from "@/types";

export const dynamic = "force-dynamic";

const log = createLogger("api:jobs:apply");

/**
 * POST /api/jobs/:id/apply
 *
 * Prepares everything the candidate needs (tailored resume, cover letter,
 * answers, readiness check) and returns the OFFICIAL application URL.
 *
 * ApplySwipe does not submit the application on the employer's behalf: the
 * status stays "prepared" until the candidate confirms the external submission
 * (`POST /api/applications/:id/apply-confirmation` or the application status
 * update endpoint).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();

    const job = (await db.job.findUnique({ where: { id: params.id } })) as Job | null;
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (job.canonicalJobId) {
      return NextResponse.json(
        { error: "This opening is a duplicate of another listing", canonicalJobId: job.canonicalJobId },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const mode = (body?.mode as ApplicationMode) || "REVIEW_EVERYTHING";

    // Applying implies a positive swipe.
    await recordSwipe(user.id, job, "LIKE").catch(() => undefined);

    const result = await prepareApplication(user.id, job, mode);

    return NextResponse.json({
      success: true,
      applicationId: result.application.id,
      status: result.application.status,
      capability: result.agent.capability,
      message: result.message,
      requiresManualHandoff: true,
      submitted: false,
      readiness: result.readiness,
      officialApplicationUrl: result.readiness.officialApplicationUrl,
      sourceLabel: result.job.sourceLabel,
      preparedMaterials: {
        ...result.agent.preparedMaterials,
        readiness: result.readiness,
      },
      job: result.job,
    });
  } catch (error: any) {
    log.error("apply failed", { error: error?.message });
    const status = error?.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json(
      { error: error?.message || "Failed to prepare application" },
      { status }
    );
  }
}
