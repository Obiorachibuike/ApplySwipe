import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/jwt";
import db from "@/lib/db";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const jobId = params.id;

    await db.jobInteraction.create({
      data: {
        userId: user.id,
        jobId,
        interactionType: "PASSED",
      },
    });

    return NextResponse.json({ success: true, message: "Job passed" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 });
  }
}
