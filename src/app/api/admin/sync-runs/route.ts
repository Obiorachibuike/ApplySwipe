import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/jwt";
import { listSyncRuns } from "@/jobs/ingestion/provider-state";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/sync-runs?provider=LEVER&limit=25
 * Sync history with per-run statistics and errors (admin sync diagnostics).
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const runs = await listSyncRuns(
      searchParams.get("provider") || undefined,
      Math.min(100, Number(searchParams.get("limit")) || 25)
    );
    return NextResponse.json({ success: true, runs });
  } catch (error: any) {
    const status = error?.message === "Unauthorized" ? 401 : 403;
    return NextResponse.json({ error: error?.message || "Unauthorized" }, { status });
  }
}
