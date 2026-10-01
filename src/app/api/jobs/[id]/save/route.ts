import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/jwt";
import db from "@/lib/db";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const jobId = params.id;

    // Check if already saved
    const existing = await db.savedJob.findFirst({
      where: { userId: user.id, jobId },
    });

    if (existing) {
      await db.savedJob.delete({ where: { id: existing.id } });
      return NextResponse.json({ success: true, isSaved: false, message: "Job removed from saved" });
    }

    await db.savedJob.create({
      data: {
        userId: user.id,
        jobId,
      },
    });

    await db.jobInteraction.create({
      data: {
        userId: user.id,
        jobId,
        interactionType: "SAVED",
      },
    });

    return NextResponse.json({ success: true, isSaved: true, message: "Job saved successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 });
  }
}
