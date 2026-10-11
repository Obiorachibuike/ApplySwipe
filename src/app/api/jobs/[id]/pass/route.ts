import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/jwt";
import db from "@/lib/db";
import { recordSwipe } from "@/jobs/services/application-service";
import type { Job } from "@/types";

export const dynamic = "force-dynamic";

/** POST /api/jobs/:id/pass - records a PASS swipe (idempotent). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();

    const job = (await db.job.findUnique({ where: { id: params.id } })) as Job | null;
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const { created } = await recordSwipe(user.id, job, "PASS");

    return NextResponse.json({ success: true, created, message: "Job passed" });
  } catch (error: any) {
    const status = error?.message === "Unauthorized" ? 401 : error?.statusCode === 409 ? 409 : 500;
    return NextResponse.json({ error: error?.message || "Failed to pass job" }, { status });
  }
}
