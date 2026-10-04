import { asArray, asNumber, asString, fetchJson, ProviderError } from "@/jobs/providers/http";
import type {
  JobProvider,
  JobSearchParams,
  JobSourceConfig,
  NormalizedJob,
  ProviderContext,
  ProviderName,
} from "@/jobs/providers/types";
import {
  buildNormalizedJob,
  extractSalaryFromText,
  normalizeSalary,
  providerDescriptionToText,
  normalizeWorkplaceType,
} from "@/jobs/ingestion/normalize";
import { createLogger } from "@/lib/logger";

const log = createLogger("jobs:provider:greenhouse");

const DEFAULT_BASE_URL = process.env.GREENHOUSE_BASE_URL || "https://boards-api.greenhouse.io";

interface GreenhouseJob {
  id?: number | string;
  internal_job_id?: number | string;
  requisition_id?: string;
  title?: string;
  updated_at?: string;
  created_at?: string;
  location?: { name?: string };
  offices?: { id?: number; name?: string }[];
  departments?: { id?: number; name?: string }[];
  metadata?: { name?: string; value?: unknown }[] | null;
  content?: string;
  absolute_url?: string;
  company_name?: string;
  language?: string;
}

/**
 * Greenhouse job board adapter.
 *
 * Companies are configured in the database (`JobSource` rows with
 * provider = GREENHOUSE, boardToken = <board token>) and managed through the
 * admin API - no company is ever hard-coded here.
 */
export class GreenhouseAdapter implements JobProvider {
  public readonly name: ProviderName = "GREENHOUSE";
  public readonly label = "Company career page (Greenhouse)";
  public readonly requiresSource = true;
  public readonly supportsSearch = true;

  private readonly baseUrl = DEFAULT_BASE_URL.replace(/\/$/, "");

  private requireToken(source?: JobSourceConfig): string {
    const token = source?.boardToken?.trim();
    if (!token) {
      throw new ProviderError(
        "Greenhouse board token missing - configure the company in Job Sources",
        { kind: "CONFIG", provider: "GREENHOUSE", retryable: false }
      );
    }
    return token;
  }

  /** Fetch the published jobs for one configured company board. */
  public async search(
    params: JobSearchParams = {},
    context: ProviderContext = {}
  ): Promise<NormalizedJob[]> {
    const source = context.source;
    const token = this.requireToken(source);
    const url = `${this.baseUrl}/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;

    const payload = await fetchJson<{ jobs?: GreenhouseJob[] }>(url, {
      provider: "GREENHOUSE",
      fetchImpl: context.fetchImpl,
      timeoutMs: context.timeoutMs,
      retries: context.retries,
      signal: context.signal,
      validate: (data) => {
        if (!data || typeof data !== "object" || !Array.isArray((data as any).jobs)) {
          throw new ProviderError("Greenhouse board response missing `jobs` array", {
            kind: "MALFORMED",
            provider: "GREENHOUSE",
          });
        }
      },
    });

    const jobs = asArray<GreenhouseJob>(payload.jobs);
    const limit = params.limit && params.limit > 0 ? params.limit : undefined;

    const normalized: NormalizedJob[] = [];
    for (const raw of jobs) {
      const job = this.normalizeJob(raw, source);
      if (!job) continue;
      if (params.query && !matchesQuery(job, params.query)) continue;
      if (params.location && !(job.location || "").toLowerCase().includes(params.location.toLowerCase()))
        continue;
      if (params.remote && job.workplaceType !== "REMOTE") continue;
      if (!matchesSourceFilters(job, source)) continue;
      normalized.push(job);
      if (limit && normalized.length >= limit) break;
    }

    return normalized;
  }

  /** Fetch a single published job by its Greenhouse job id. */
  public async getJob(
    externalId: string,
    context: ProviderContext = {}
  ): Promise<NormalizedJob | null> {
    const source = context.source;
    const token = this.requireToken(source);
    const url = `${this.baseUrl}/v1/boards/${encodeURIComponent(token)}/jobs/${encodeURIComponent(
      externalId
    )}?questions=false`;

    try {
      const payload = await fetchJson<GreenhouseJob>(url, {
        provider: "GREENHOUSE",
        fetchImpl: context.fetchImpl,
        timeoutMs: context.timeoutMs,
        retries: context.retries,
        signal: context.signal,
      });

      if (asNumber(payload?.id) === undefined && !asString(payload?.title)) return null;
      return this.normalizeJob(payload, source);
    } catch (error) {
      if (error instanceof ProviderError && error.status === 404) return null;
      throw error;
    }
  }

  /** Maps a raw Greenhouse job record onto the canonical shape. */
  public normalizeJob(
    raw: GreenhouseJob,
    source?: JobSourceConfig
  ): NormalizedJob | null {
    if (!raw || raw.id === undefined || raw.id === null) return null;

    const descriptionText = providerDescriptionToText(asString(raw.content));

    const departments = asArray<{ name?: string }>(raw.departments)
      .map((d) => asString(d?.name))
      .filter(Boolean);
    const offices = asArray<{ name?: string }>(raw.offices)
      .map((o) => asString(o?.name))
      .filter(Boolean);

    const metadata = asArray<{ name?: string; value?: unknown }>(raw.metadata);

    const salaryFromMetadata = extractSalaryFromMetadata(metadata);
    const salary =
      salaryFromMetadata.min || salaryFromMetadata.max
        ? salaryFromMetadata
        : extractSalaryFromText(descriptionText);

    const locationName =
      asString(raw.location?.name) || offices[0] || (salary ? "Location not specified" : "");

    const absoluteUrl = asString(raw.absolute_url);
    const boardToken = source?.boardToken;
    const fallbackUrl =
      boardToken && raw.id !== undefined
        ? `https://job-boards.greenhouse.io/${boardToken}/jobs/${raw.id}`
        : "";

    try {
      return buildNormalizedJob({
        provider: "GREENHOUSE",
        externalId: String(raw.id),
        title: raw.title,
        companyName: asString(raw.company_name) || source?.companyName,
        description: descriptionText,
        location: locationName,
        remoteFlag: undefined,
        employmentType: asString(metadataValue(metadata, ["employment type", "employment_type"])),
        seniority: asString(metadataValue(metadata, ["seniority", "level", "experience level"])),
        skills: departments,
        salary,
        postedAt: raw.updated_at || raw.created_at,
        sourceUrl: absoluteUrl || fallbackUrl,
        applicationUrl: absoluteUrl || fallbackUrl,
        applicationType: "API_SUPPORTED",
        atsProvider: "GREENHOUSE",
        rawData: {
          greenhouseId: raw.id,
          internalJobId: raw.internal_job_id,
          requisitionId: raw.requisition_id,
          departments,
          offices,
          location: asString(raw.location?.name),
          boardToken,
          updatedAt: raw.updated_at || null,
        },
      });
    } catch (error) {
      log.debug("skipping malformed greenhouse job", {
        id: raw.id,
        reason: (error as Error).message,
      });
      return null;
    }
  }

  public workplaceTypeFor(raw: GreenhouseJob): string {
    return normalizeWorkplaceType({
      location: asString(raw.location?.name),
      description: asString(raw.content),
    });
  }
}

function metadataValue(
  metadata: { name?: string; value?: unknown }[],
  names: string[]
): string | undefined {
  for (const entry of metadata) {
    const name = asString(entry?.name).toLowerCase();
    if (!name) continue;
    if (names.some((candidate) => name === candidate || name.includes(candidate))) {
      const value = entry?.value;
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number") return String(value);
    }
  }
  return undefined;
}

function extractSalaryFromMetadata(
  metadata: { name?: string; value?: unknown }[]
): { min?: number; max?: number; currency?: string; interval?: string } {
  const raw = metadataValue(metadata, ["salary", "compensation", "pay range", "pay range"]);
  if (!raw) return {};

  const parts = raw.split(/[-–—]| to /i).map((p) => p.replace(/[^0-9.]/g, ""));
  const currencyMatch = raw.match(/[$£€₦₹]|\b(usd|gbp|eur|ngn|inr|cad|aud)\b/i);
  const min = Number(parts[0]);
  const max = Number(parts[1]);

  return normalizeSalary({
    min: Number.isFinite(min) ? min : undefined,
    max: Number.isFinite(max) ? max : undefined,
    currency: currencyMatch?.[0],
    interval: /hour/i.test(raw) ? "hour" : "year",
  });
}

function matchesQuery(job: NormalizedJob, query: string): boolean {
  const needle = query.toLowerCase();
  return (
    job.title.toLowerCase().includes(needle) ||
    job.description.toLowerCase().includes(needle) ||
    job.skills.some((skill) => skill.toLowerCase().includes(needle))
  );
}

function matchesSourceFilters(job: NormalizedJob, source?: JobSourceConfig): boolean {
  const filters = source?.config?.locations;
  if (!filters || filters.length === 0) return true;
  const location = (job.location || "").toLowerCase();
  return filters.some((fragment) => location.includes(fragment.toLowerCase()));
}

export const greenhouseAdapter = new GreenhouseAdapter();
