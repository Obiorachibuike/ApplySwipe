import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/jwt";
import db from "@/lib/db";
import { toggleSavedJob } from "@/jobs/services/application-service";
import type { Job } from "@/types";

export const dynamic = "force-dynamic";

/** POST /api/jobs/:id/save - toggles the bookmark for a job (idempotent). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();

    const job = (await db.job.findUnique({ where: { id: params.id } })) as Job | null;
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const { isSaved } = await toggleSavedJob(user.id, job);

    return NextResponse.json({
      success: true,
      isSaved,
      message: isSaved ? "Job saved successfully" : "Job removed from saved",
    });
  } catch (error: any) {
    const status = error?.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error?.message || "Failed to save job" }, { status });
  }
}
