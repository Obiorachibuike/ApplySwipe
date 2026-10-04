import { NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { emailService } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      await emailService.send({
        to: email,
        subject: "Reset your ApplySwipe password",
        html: `<p>Click here to reset your password: <a href="https://applyswipe.io/reset-password?token=demo">Reset Password</a></p>`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, password reset instructions have been sent.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
