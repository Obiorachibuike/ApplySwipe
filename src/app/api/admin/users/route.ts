import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/jwt";
import db from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
    const users = await db.user.findMany({
      include: {
        profile: true,
        applications: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const safeUsers = users.map(({ passwordHash, ...rest }: any) => rest);
    return NextResponse.json({ success: true, users: safeUsers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 });
  }
}
