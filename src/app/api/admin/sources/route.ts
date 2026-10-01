import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/jwt";
import db from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
    const sources = await db.jobSource.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, sources });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 });
  }
}
