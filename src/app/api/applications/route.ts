import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/jwt";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: any = { userId: user.id };
    if (status) {
      where.status = status;
    }

    const applications = await db.application.findMany({
      where,
      include: {
        job: true,
        answers: true,
        documents: true,
        events: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      applications,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch applications" }, { status: 500 });
  }
}
