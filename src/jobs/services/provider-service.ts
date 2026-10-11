import db from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { hasProvider, listProviders, getProviderInfo } from "@/jobs/providers";
import { freshnessHours, syncIntervalMinutes } from "@/jobs/ingestion/freshness";
import { providerHealthReport, setProviderEnabled } from "@/jobs/ingestion/provider-state";
import type { JobSource, JobProviderName } from "@/types";

const log = createLogger("jobs:provider-service");

/**
 * Provider + job source administration.
 *
 * Companies are configured here (or through the admin UI) instead of being
 * hard-coded: a Greenhouse board token or a Lever company slug is enough to add
 * a new employer to the ingestion pipeline.
 */

export interface JobSourceInput {
  provider: string;
  name?: string;
  companyName: string;
  /** Greenhouse board token / Lever company slug. */
  boardToken?: string;
  companySlug?: string;
  url?: string;
  active?: boolean;
  config?: Record<string, unknown> | null;
}

const SECRET_KEY_PATTERN = /key|secret|token|password|credential/i;

/** Strips anything that could be a credential before returning a source. */
export function sanitizeJobSource(source: JobSource): JobSource {
  if (!source.config || typeof source.config !== "object") return source;
  const config: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source.config as Record<string, unknown>)) {
    config[key] = SECRET_KEY_PATTERN.test(key) ? "***" : value;
  }
  return { ...source, config };
}

export async function listJobSources(provider?: string): Promise<JobSource[]> {
  const where = provider ? { provider: provider.toUpperCase() } : {};
  const sources = (await db.jobSource.findMany({ where, orderBy: { createdAt: "desc" } })) as JobSource[];
  return sources.map(sanitizeJobSource);
}

export function validateJobSource(input: JobSourceInput): string[] {
  const errors: string[] = [];
  if (!input.provider || !hasProvider(String(input.provider))) {
    errors.push(`provider must be one of: ${listProviders().join(", ")}`);
  }
  if (!input.companyName || !String(input.companyName).trim()) {
    errors.push("companyName is required");
  }
  const token = input.boardToken || input.companySlug;
  const provider = String(input.provider || "").toUpperCase();
  if ((provider === "GREENHOUSE" || provider === "LEVER") && !token) {
    errors.push(
      provider === "GREENHOUSE"
        ? "boardToken is required (Greenhouse board token)"
        : "boardToken is required (Lever company slug)"
    );
  }
  return errors;
}

export async function createJobSource(input: JobSourceInput): Promise<JobSource> {
  const errors = validateJobSource(input);
  if (errors.length > 0) {
    throw Object.assign(new Error(errors.join("; ")), { statusCode: 400 });
  }

  const provider = String(input.provider).toUpperCase() as JobProviderName;
  const boardToken = (input.boardToken || input.companySlug || "").trim();
  const companyName = String(input.companyName).trim();

  const existing = (await db.jobSource.findMany({ where: { provider } })) as JobSource[];
  const duplicate = existing.find(
    (source) => (source.boardToken || "").toLowerCase() === boardToken.toLowerCase()
  );
  if (duplicate) {
    throw Object.assign(
      new Error(`${provider} source "${duplicate.companyName || duplicate.name}" already exists`),
      { statusCode: 409 }
    );
  }

  const created = (await db.jobSource.create({
    data: {
      name: input.name || `${companyName} (${provider})`,
      type: provider === "ADZUNA" ? "API" : "ATS",
      url: input.url || null,
      provider,
      companyName,
      boardToken: boardToken || null,
      active: input.active !== false,
      isActive: input.active !== false,
      config: input.config || null,
      lastSyncAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastError: null,
      jobsImported: 0,
      jobCount: 0,
    },
  })) as JobSource;

  log.info("job source created", { provider, companyName, boardToken });
  return sanitizeJobSource(created);
}

export async function updateJobSource(id: string, patch: Partial<JobSourceInput>): Promise<JobSource> {
  const existing = (await db.jobSource.findUnique({ where: { id } })) as JobSource | null;
  if (!existing) {
    throw Object.assign(new Error("Job source not found"), { statusCode: 404 });
  }

  const data: Record<string, unknown> = {};
  if (patch.companyName !== undefined) data.companyName = String(patch.companyName).trim();
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.boardToken !== undefined || patch.companySlug !== undefined) {
    data.boardToken = (patch.boardToken || patch.companySlug || "").trim() || null;
  }
  if (patch.active !== undefined) {
    data.active = Boolean(patch.active);
    data.isActive = Boolean(patch.active);
  }
  if (patch.config !== undefined) data.config = patch.config;
  if (patch.url !== undefined) data.url = patch.url;

  const updated = (await db.jobSource.update({ where: { id }, data })) as JobSource;
  return sanitizeJobSource(updated);
}

export async function deactivateJobSource(id: string): Promise<JobSource> {
  return updateJobSource(id, { active: false });
}

export interface ProviderOverview {
  providers: Awaited<ReturnType<typeof providerHealthReport>>;
  info: ReturnType<typeof getProviderInfo>;
  freshness: { provider: string; freshnessHours: number; syncIntervalMinutes: number }[];
}

/** Health + configuration overview for the admin console (no secrets). */
export async function providerOverview(): Promise<ProviderOverview> {
  const providers = await providerHealthReport();
  return {
    providers,
    info: getProviderInfo(),
    freshness: listProviders().map((provider) => ({
      provider,
      freshnessHours: freshnessHours(provider),
      syncIntervalMinutes: syncIntervalMinutes(provider),
    })),
  };
}

export async function setProviderEnabledByName(provider: string, isEnabled: boolean) {
  if (!hasProvider(provider)) {
    throw Object.assign(new Error(`Unknown provider: ${provider}`), { statusCode: 400 });
  }
  return setProviderEnabled(provider, isEnabled);
}

/** Providers that are configured and enabled (used by the sync worker). */
export async function enabledProviders(): Promise<string[]> {
  const report = await providerHealthReport();
  return report.filter((entry) => entry.isEnabled).map((entry) => entry.provider);
}
