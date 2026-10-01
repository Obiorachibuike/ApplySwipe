import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/jwt";
import db from "@/lib/db";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const resume = await db.resume.findUnique({ where: { id: params.id } });

    if (!resume || resume.userId !== user.id) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const { name, isDefault, rawText } = await req.json();

    if (isDefault) {
      await db.resume.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }

    const updated = await db.resume.update({
      where: { id: params.id },
      data: {
        ...(name ? { name } : {}),
        ...(rawText !== undefined ? { rawText } : {}),
        ...(isDefault !== undefined ? { isDefault } : {}),
      },
    });

    return NextResponse.json({ success: true, resume: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update resume" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const resume = await db.resume.findUnique({ where: { id: params.id } });

    if (!resume || resume.userId !== user.id) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    await db.resume.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true, message: "Resume deleted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete resume" }, { status: 500 });
  }
}
