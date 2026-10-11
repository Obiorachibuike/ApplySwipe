import { asArray, asString, fetchJson, ProviderError } from "@/jobs/providers/http";
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
  normalizeWorkplaceType,
} from "@/jobs/ingestion/normalize";
import { createLogger } from "@/lib/logger";

const log = createLogger("jobs:provider:lever");

const DEFAULT_BASE_URL = process.env.LEVER_BASE_URL || "https://api.lever.co";
const MAX_PAGE_SIZE = 100;

interface LeverSalaryRange {
  min?: number;
  max?: number;
  currency?: string;
  interval?: string;
}

interface LeverPosting {
  id?: string;
  text?: string;
  description?: string;
  descriptionPlain?: string;
  additional?: string;
  additionalPlain?: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  updatedAt?: number;
  workplaceType?: string;
  salaryRange?: LeverSalaryRange | null;
  categories?: {
    location?: string;
    allLocations?: string[];
    team?: string;
    department?: string;
    commitment?: string;
    level?: string;
  };
  lists?: { text?: string; content?: string }[];
  country?: string;
}

/**
 * Lever postings adapter.
 *
 * Companies (company slugs) are configured in the database as `JobSource`
 * rows with provider = LEVER and boardToken = <company slug>.
 */
export class LeverAdapter implements JobProvider {
  public readonly name: ProviderName = "LEVER";
  public readonly label = "Company career page (Lever)";
  public readonly requiresSource = true;
  public readonly supportsSearch = false;

  private readonly baseUrl = DEFAULT_BASE_URL.replace(/\/$/, "");

  private requireSlug(source?: JobSourceConfig): string {
    const slug = source?.boardToken?.trim();
    if (!slug) {
      throw new ProviderError("Lever company slug missing - configure the company in Job Sources", {
        kind: "CONFIG",
        provider: "LEVER",
        retryable: false,
      });
    }
    return slug;
  }

  /**
   * Fetch postings for one configured company.
   * Lever's postings endpoint returns the full board; `skip`/`limit` are sent
   * when the caller paginates explicitly.
   */
  public async search(
    params: JobSearchParams = {},
    context: ProviderContext = {}
  ): Promise<NormalizedJob[]> {
    const source = context.source;
    const slug = this.requireSlug(source);
    const url = this.buildUrl(slug, params);

    const payload = await fetchJson<LeverPosting[]>(url, {
      provider: "LEVER",
      fetchImpl: context.fetchImpl,
      timeoutMs: context.timeoutMs,
      retries: context.retries,
      signal: context.signal,
      validate: (data) => {
        if (!Array.isArray(data)) {
          throw new ProviderError("Lever postings response was not an array", {
            kind: "MALFORMED",
            provider: "LEVER",
          });
        }
      },
    });

    const postings = asArray<LeverPosting>(payload);
    const normalized: NormalizedJob[] = [];

    for (const raw of postings) {
      const job = this.normalizePosting(raw, source);
      if (!job) continue;
      if (params.query && !matchesQuery(job, params.query)) continue;
      if (params.location && !(job.location || "").toLowerCase().includes(params.location.toLowerCase()))
        continue;
      if (params.remote && job.workplaceType !== "REMOTE") continue;
      if (!matchesSourceFilters(job, source)) continue;
      normalized.push(job);
    }

    return normalized;
  }

  /** Fetch a single posting (used by admin inspection and re-sync of one job). */
  public async getJob(
    externalId: string,
    context: ProviderContext = {}
  ): Promise<NormalizedJob | null> {
    const source = context.source;
    const slug = this.requireSlug(source);
    const url = `${this.baseUrl}/v0/postings/${encodeURIComponent(slug)}/${encodeURIComponent(
      externalId
    )}?mode=json`;

    try {
      const payload = await fetchJson<LeverPosting>(url, {
        provider: "LEVER",
        fetchImpl: context.fetchImpl,
        timeoutMs: context.timeoutMs,
        retries: context.retries,
        signal: context.signal,
      });
      if (!payload || !asString(payload?.id)) return null;
      return this.normalizePosting(payload, source);
    } catch (error) {
      if (error instanceof ProviderError && error.status === 404) return null;
      throw error;
    }
  }

  private buildUrl(slug: string, params: JobSearchParams): string {
    const search = new URLSearchParams({ mode: "json" });
    const limit = params.limit ? Math.min(MAX_PAGE_SIZE, params.limit) : undefined;
    if (limit && limit > 0) {
      search.set("limit", String(limit));
      const skip = Math.max(0, ((params.page || 1) - 1) * limit);
      if (skip > 0) search.set("skip", String(skip));
    }
    return `${this.baseUrl}/v0/postings/${encodeURIComponent(slug)}?${search.toString()}`;
  }

  /** Maps a raw Lever posting onto the canonical shape. */
  public normalizePosting(
    raw: LeverPosting,
    source?: JobSourceConfig
  ): NormalizedJob | null {
    if (!raw || !raw.id) return null;

    const descriptionText = asString(raw.descriptionPlain) || asString(raw.description);
    const additionalText = asString(raw.additionalPlain) || asString(raw.additional);
    const description = [descriptionText, additionalText].filter(Boolean).join("\n\n");

    const structuredSalary = raw.salaryRange
      ? normalizeSalary({
          min: raw.salaryRange.min,
          max: raw.salaryRange.max,
          currency: raw.salaryRange.currency,
          interval: raw.salaryRange.interval,
        })
      : {};
    const salary =
      structuredSalary.min || structuredSalary.max
        ? structuredSalary
        : extractSalaryFromText(description);

    const categories = raw.categories || {};
    const location =
      asString(categories.location) ||
      asArray<string>(categories.allLocations)[0] ||
      undefined;

    const workplaceType = normalizeWorkplaceType({
      location: typeof location === "string" ? location : undefined,
      description,
      remoteFlag: leverWorkplaceFlag(raw.workplaceType),
    });

    const hostedUrl = asString(raw.hostedUrl);
    const applyUrl = asString(raw.applyUrl) || hostedUrl;

    try {
      return buildNormalizedJob({
        provider: "LEVER",
        externalId: String(raw.id),
        title: raw.text,
        companyName: source?.companyName,
        description,
        location,
        remoteFlag: workplaceType === "REMOTE" ? true : undefined,
        employmentType: asString(categories.commitment),
        seniority: asString(categories.level) || asString(categories.team),
        skills: [asString(categories.team), asString(categories.department), asString(categories.commitment)],
        salary,
        postedAt: raw.createdAt ? new Date(raw.createdAt) : raw.updatedAt ? new Date(raw.updatedAt) : undefined,
        sourceUrl: hostedUrl,
        applicationUrl: applyUrl,
        applicationType: "API_SUPPORTED",
        atsProvider: "LEVER",
        rawData: {
          leverId: raw.id,
          team: categories.team,
          department: categories.department,
          commitment: categories.commitment,
          allLocations: categories.allLocations || [],
          workplaceType: raw.workplaceType || null,
          salaryRange: raw.salaryRange || null,
          createdAt: raw.createdAt || null,
          companySlug: source?.boardToken,
          boardToken: source?.boardToken,
        },
      });
    } catch (error) {
      log.debug("skipping malformed lever posting", {
        id: raw.id,
        reason: (error as Error).message,
      });
      return null;
    }
  }
}

function leverWorkplaceFlag(value: unknown): boolean | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase();
  if (normalized === "remote") return true;
  if (normalized === "on-site" || normalized === "onsite") return false;
  return undefined;
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

export const leverAdapter = new LeverAdapter();
