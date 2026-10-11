import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/jwt";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getApplicationForUser, markAppliedExternally } from "@/jobs/services/application-service";
import { resolveOfficialApplicationUrl, sourceLabelForProvider } from "@/jobs/services/job-service";
import type { Job } from "@/types";

export const dynamic = "force-dynamic";

const log = createLogger("api:applications:confirm");

/**
 * POST /api/applications/:id/apply-confirmation
 *
 * The candidate confirms they submitted the application on the employer's site.
 * This is the ONLY path that moves an application to APPLIED - ApplySwipe never
 * claims a submission it did not perform.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();

    const application = await getApplicationForUser(user.id, params.id);
    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const updated = await markAppliedExternally(user.id, params.id);

    const job = (application.job as Job | null) || null;

    return NextResponse.json({
      success: true,
      application: {
        ...updated,
        job,
      },
      officialApplicationUrl: job ? resolveOfficialApplicationUrl(job) : null,
      sourceLabel: job ? sourceLabelForProvider(job.provider, job.source) : null,
      message: "Application marked as applied. Good luck!",
    });
  } catch (error: any) {
    log.error("apply confirmation failed", { error: error?.message });
    const status = error?.statusCode === 404 ? 404 : error?.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error?.message || "Failed to confirm application" }, { status });
  }
}

/** GET returns the readiness snapshot without changing any status. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const application = await getApplicationForUser(user.id, params.id);
    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const documents = (await db.applicationDocument.findMany({ where: { applicationId: params.id } })) as {
      type: string;
    }[];

    const job = application.job as Job | null;

    return NextResponse.json({
      success: true,
      status: application.status,
      appliedAt: application.appliedAt || null,
      readiness: {
        tailoredResume: documents.some((doc) => doc.type === "TAILORED_RESUME"),
        coverLetter: documents.some((doc) => doc.type === "COVER_LETTER"),
        missing: [
          ...(documents.some((doc) => doc.type === "TAILORED_RESUME") ? [] : ["tailored_resume"]),
          ...(documents.some((doc) => doc.type === "COVER_LETTER") ? [] : ["cover_letter"]),
        ],
        officialApplicationUrl: job ? resolveOfficialApplicationUrl(job) : null,
      },
    });
  } catch (error: any) {
    const status = error?.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error?.message || "Failed to load application" }, { status });
  }
}
