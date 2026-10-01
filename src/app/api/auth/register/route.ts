import { NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { hashPassword, signToken, COOKIE_NAME } from "@/lib/auth/jwt";

const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    const existing = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: "USER",
        isVerified: true,
        emailVerifiedAt: new Date().toISOString(),
      },
    });

    // Create empty profile
    await db.profile.create({
      data: {
        userId: user.id,
        targetRoles: [],
        preferredIndustries: [],
        preferredEmploymentTypes: ["Full-time"],
        salaryCurrency: "USD",
        onboardingCompleted: false,
      },
    });

    // Create default user preferences
    await db.userPreference.create({
      data: {
        userId: user.id,
        targetRoles: [],
        remoteOnly: false,
        preferredLocations: ["Remote"],
        employmentTypes: ["Full-time"],
        excludedCompanies: [],
        salaryCurrency: "USD",
      },
    });

    // Create default autopilot settings
    await db.autopilotSetting.create({
      data: {
        userId: user.id,
        isEnabled: false,
        minMatchScore: 85,
        dailyLimit: 10,
        applicationsToday: 0,
        allowedRoles: [],
        allowedLocations: ["Remote"],
        employmentTypes: ["Full-time"],
        excludedCompanies: [],
        mode: "REVIEW_EVERYTHING",
      },
    });

    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        onboardingCompleted: false,
      },
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error during registration." },
      { status: 500 }
    );
  }
}
