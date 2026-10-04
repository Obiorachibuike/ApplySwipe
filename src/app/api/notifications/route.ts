import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/jwt";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAuth();
    const notifications = await db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, notifications });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireAuth();
    const { id, all } = await req.json();

    if (all) {
      await db.notification.updateMany({
        where: { userId: user.id },
        data: { isRead: true },
      });
    } else if (id) {
      await db.notification.update({
        where: { id },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true, message: "Notifications updated" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update notifications" }, { status: 500 });
  }
}
