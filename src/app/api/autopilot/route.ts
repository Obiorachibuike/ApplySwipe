import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/jwt";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAuth();
    let setting = await db.autopilotSetting.findUnique({
      where: { userId: user.id },
    });

    if (!setting) {
      setting = await db.autopilotSetting.create({
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
    }

    return NextResponse.json({ success: true, setting });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch autopilot settings" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();

    const {
      isEnabled,
      minMatchScore,
      dailyLimit,
      allowedRoles,
      allowedLocations,
      minSalary,
      employmentTypes,
      excludedCompanies,
      mode,
    } = body;

    const updated = await db.autopilotSetting.upsert({
      where: { userId: user.id },
      update: {
        ...(isEnabled !== undefined ? { isEnabled } : {}),
        ...(minMatchScore !== undefined ? { minMatchScore: Number(minMatchScore) } : {}),
        ...(dailyLimit !== undefined ? { dailyLimit: Number(dailyLimit) } : {}),
        ...(allowedRoles !== undefined ? { allowedRoles } : {}),
        ...(allowedLocations !== undefined ? { allowedLocations } : {}),
        ...(minSalary !== undefined ? { minSalary: Number(minSalary) } : {}),
        ...(employmentTypes !== undefined ? { employmentTypes } : {}),
        ...(excludedCompanies !== undefined ? { excludedCompanies } : {}),
        ...(mode !== undefined ? { mode } : {}),
      },
      create: {
        userId: user.id,
        isEnabled: Boolean(isEnabled),
        minMatchScore: Number(minMatchScore) || 85,
        dailyLimit: Number(dailyLimit) || 10,
        allowedRoles: allowedRoles || [],
        allowedLocations: allowedLocations || ["Remote"],
        minSalary: Number(minSalary) || 0,
        employmentTypes: employmentTypes || ["Full-time"],
        excludedCompanies: excludedCompanies || [],
        mode: mode || "REVIEW_EVERYTHING",
      },
    });

    return NextResponse.json({ success: true, setting: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update autopilot" }, { status: 500 });
  }
}
