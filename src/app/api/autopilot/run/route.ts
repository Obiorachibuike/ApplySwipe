import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/jwt";
import { AutopilotService } from "@/services/autopilot";

export async function POST() {
  try {
    const user = await requireAuth();
    const summary = await AutopilotService.executeCycle(user.id);

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Autopilot execution failed" }, { status: 500 });
  }
}
