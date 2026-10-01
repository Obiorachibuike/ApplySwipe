import { NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { hashPassword } from "@/lib/auth/jwt";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      const newHash = await hashPassword(password);
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Password has been successfully updated. Please log in.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
