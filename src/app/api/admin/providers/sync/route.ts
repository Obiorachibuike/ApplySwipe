import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/jwt";
import { createLogger } from "@/lib/logger";
import { hasProvider, listProviders } from "@/jobs/providers";
import { runJobSync } from "@/workers/job-sync";

export const dynamic = "force-dynamic";

const log = createLogger("api:admin:providers:sync");

/**
 * POST /api/admin/providers/sync
 * Body (optional): { provider?: "ADZUNA" | "GREENHOUSE" | "LEVER", dryRun?: boolean }
 *
 * Triggers an ingestion run on demand. Overlapping runs are prevented by the
 * provider lock, so clicking twice is safe.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));

    const requested = body?.provider ? String(body.provider).toUpperCase() : null;
    if (requested && !hasProvider(requested)) {
      return NextResponse.json(
        { error: `Unknown provider. Supported: ${listProviders().join(", ")}` },
        { status: 400 }
      );
    }

    const summary = await runJobSync({
      providers: requested ? [requested] : undefined,
      triggeredBy: `admin:${admin.email}`,
      dryRun: body?.dryRun === true,
    });

    log.info("manual sync finished", { triggeredBy: admin.email, totals: summary.totals });

    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    log.error("manual sync failed", { error: error?.message });
    const status = error?.message === "Unauthorized" ? 401 : error?.message?.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: error?.message || "Sync failed" }, { status });
  }
}
