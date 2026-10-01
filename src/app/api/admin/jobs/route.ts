import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/jwt";
import db from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
    const jobs = await db.job.findMany({
      orderBy: { postedAt: "desc" },
    });
    return NextResponse.json({ success: true, jobs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const { jobId, isActive, isReported } = await req.json();

    const updated = await db.job.update({
      where: { id: jobId },
      data: {
        ...(isActive !== undefined ? { isActive } : {}),
        ...(isReported !== undefined ? { isReported } : {}),
      },
    });

    return NextResponse.json({ success: true, job: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update job" }, { status: 500 });
  }
}
