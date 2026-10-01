import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/jwt";
import db from "@/lib/db";

export async function GET() {
  try {
    const user = await requireAuth();
    const resumes = await db.resume.findMany({
      where: { userId: user.id },
      include: { versions: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, resumes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch resumes" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { name, rawText, isDefault } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (isDefault) {
      // Unset previous default
      await db.resume.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }

    const newResume = await db.resume.create({
      data: {
        userId: user.id,
        name,
        rawText: rawText || "",
        isDefault: Boolean(isDefault),
      },
      include: { versions: true },
    });

    return NextResponse.json({ success: true, resume: newResume });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create resume" }, { status: 500 });
  }
}
