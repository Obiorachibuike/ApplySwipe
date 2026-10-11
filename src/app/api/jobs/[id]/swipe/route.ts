import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/jwt";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { recordSwipe } from "@/jobs/services/application-service";
import { matchForJob } from "@/jobs/services/feed-service";
import { toPublicJob } from "@/jobs/services/job-service";
import type { Job, SwipeAction } from "@/types";

export const dynamic = "force-dynamic";

const log = createLogger("api:jobs:swipe");

const VALID_ACTIONS: SwipeAction[] = ["LIKE", "PASS", "SUPER_LIKE"];

/**
 * POST /api/jobs/:id/swipe
 * Body: { "action": "LIKE" | "PASS" | "SUPER_LIKE" }
 *
 * Stores one swipe decision per user/job (duplicates are prevented, previous
 * swipes are replaced). Swiping an inactive or merged job returns 409.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").toUpperCase() as SwipeAction;

    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Supported actions: ${VALID_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const job = (await db.job.findUnique({ where: { id: params.id } })) as Job | null;
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const viewerProfile = (await db.profile.findUnique({
      where: { userId: user.id },
      include: { skills: true, experiences: true, educations: true, projects: true },
    })) as never;

    const { interaction, created } = await recordSwipe(user.id, job, action);

    const match = viewerProfile ? matchForJob({ userId: user.id, profile: viewerProfile }, job) : null;

    return NextResponse.json({
      success: true,
      created,
      action,
      interaction: {
        id: interaction.id,
        jobId: interaction.jobId,
        interactionType: interaction.interactionType,
        createdAt: interaction.createdAt,
      },
      matchScore: match?.score ?? null,
      matchReason: match?.reason ?? null,
      job: toPublicJob(job),
    });
  } catch (error: any) {
    const status = error?.statusCode === 409 ? 409 : error?.message === "Unauthorized" ? 401 : 500;
    if (status === 500) log.error("swipe failed", { error: error?.message });
    return NextResponse.json({ error: error?.message || "Failed to record swipe" }, { status });
  }
}
