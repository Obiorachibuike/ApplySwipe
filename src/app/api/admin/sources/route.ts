import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/jwt";
import { createLogger } from "@/lib/logger";
import {
  createJobSource,
  deactivateJobSource,
  listJobSources,
  updateJobSource,
} from "@/jobs/services/provider-service";

export const dynamic = "force-dynamic";

const log = createLogger("api:admin:sources");

/** GET /api/admin/sources?provider=GREENHOUSE - configured job sources. */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const sources = await listJobSources(searchParams.get("provider") || undefined);
    return NextResponse.json({ success: true, sources });
  } catch (error: any) {
    const status = error?.message === "Unauthorized" ? 401 : 403;
    return NextResponse.json({ error: error?.message || "Unauthorized" }, { status });
  }
}

/**
 * POST /api/admin/sources
 * Body: { provider, companyName, boardToken, active?, config? }
 * Adds a Greenhouse board or Lever company without touching application code.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const source = await createJobSource(body);
    return NextResponse.json({ success: true, source }, { status: 201 });
  } catch (error: any) {
    log.warn("failed to create job source", { error: error?.message });
    const status = error?.statusCode || (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ error: error?.message || "Failed to create job source" }, { status });
  }
}

/** PATCH /api/admin/sources - update company name, token or active state. */
export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    if (!body?.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const source = body.deactivate ? await deactivateJobSource(body.id) : await updateJobSource(body.id, body);
    return NextResponse.json({ success: true, source });
  } catch (error: any) {
    const status = error?.statusCode || (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ error: error?.message || "Failed to update job source" }, { status });
  }
}
