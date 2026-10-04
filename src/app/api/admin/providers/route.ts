import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/jwt";
import { createLogger } from "@/lib/logger";
import { providerOverview, setProviderEnabledByName } from "@/jobs/services/provider-service";

export const dynamic = "force-dynamic";

const log = createLogger("api:admin:providers");

/**
 * GET /api/admin/providers
 *
 * Provider health monitor: status, last sync, last successful sync, last error,
 * jobs imported and active jobs per provider. Credentials are never returned -
 * only the *names* of required environment variables.
 */
export async function GET() {
  try {
    await requireAdmin();
    const overview = await providerOverview();
    return NextResponse.json({ success: true, ...overview });
  } catch (error: any) {
    const status = error?.message === "Unauthorized" ? 401 : 403;
    return NextResponse.json({ error: error?.message || "Unauthorized" }, { status });
  }
}

/** PATCH /api/admin/providers - enable/disable a provider. */
export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    if (!body?.provider || typeof body?.isEnabled !== "boolean") {
      return NextResponse.json({ error: "provider and isEnabled are required" }, { status: 400 });
    }

    const state = await setProviderEnabledByName(body.provider, body.isEnabled);
    return NextResponse.json({ success: true, state });
  } catch (error: any) {
    log.warn("failed to update provider state", { error: error?.message });
    const status = error?.statusCode || (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ error: error?.message || "Failed to update provider" }, { status });
  }
}
