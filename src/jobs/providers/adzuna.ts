import { asArray, fetchJson, ProviderError } from "@/jobs/providers/http";
import type {
  JobProvider,
  JobSearchParams,
  NormalizedJob,
  ProviderContext,
  ProviderName,
} from "@/jobs/providers/types";
import {
  buildNormalizedJob,
  normalizeSalary,
} from "@/jobs/ingestion/normalize";
import { createLogger } from "@/lib/logger";

const log = createLogger("jobs:provider:adzuna");

const DEFAULT_BASE_URL = "https://api.adzuna.com/v1/api/jobs";
const DEFAULT_COUNTRY = process.env.ADZUNA_COUNTRY || "gb";
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 50;

interface AdzunaResult {
  id?: string | number;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string | boolean;
  contract_time?: string;
  contract_type?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  category?: { label?: string; tag?: string };
  latitude?: number;
  longitude?: number;
}

interface AdzunaResponse {
  count?: number;
  results?: AdzunaResult[];
}

/**
 * Adzuna adapter.
 *
 * Credentials are read from the server environment only (ADZUNA_APP_ID /
 * ADZUNA_APP_KEY) and are never sent to the browser: every Adzuna request is
 * proxied through the ApplySwipe backend / ingestion worker.
 */
export class AdzunaAdapter implements JobProvider {
  public readonly name: ProviderName = "ADZUNA";
  public readonly label = "Adzuna";
  public readonly requiresSource = false;
  public readonly supportsSearch = true;

  private readonly appId = process.env.ADZUNA_APP_ID || "";
  private readonly appKey = process.env.ADZUNA_APP_KEY || "";
  private readonly baseUrl = (process.env.ADZUNA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  private readonly defaultCountry = DEFAULT_COUNTRY;

  public isConfigured(): boolean {
    return Boolean(this.appId && this.appKey);
  }

  private buildUrl(
    path: string,
    params: Record<string, string | number | undefined>
  ): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === "") continue;
      search.set(key, String(value));
    }
    return `${this.baseUrl}${path}?${search.toString()}`;
  }

  private async request<T>(
    url: string,
    context: ProviderContext | undefined,
    scope: string
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new ProviderError(
        "Adzuna credentials are missing (ADZUNA_APP_ID / ADZUNA_APP_KEY)",
        { kind: "CONFIG", provider: "ADZUNA", retryable: false }
      );
    }

    try {
      return await fetchJson<T>(url, {
        provider: "ADZUNA",
        fetchImpl: context?.fetchImpl,
        timeoutMs: context?.timeoutMs,
        retries: context?.retries,
        signal: context?.signal,
        validate: (payload) => {
          if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            if (Array.isArray(payload) && scope === "search") return;
            throw new ProviderError("Adzuna payload was not an object", {
              kind: "MALFORMED",
              provider: "ADZUNA",
            });
          }
        },
      });
    } catch (error) {
      const providerError =
        error instanceof ProviderError
          ? error
          : new ProviderError(`Adzuna request failed: ${(error as Error).message}`, {
              kind: "NETWORK",
              provider: "ADZUNA",
            });
      log.warn("adzuna request failed", { scope, kind: providerError.kind, status: providerError.status });
      throw providerError;
    }
  }

  /** Keyword/location/pagination search against the Adzuna jobs API. */
  public async search(
    params: JobSearchParams = {},
    context: ProviderContext = {}
  ): Promise<NormalizedJob[]> {
    const country = (params.country || this.defaultCountry).toLowerCase();
    const page = Math.max(1, Math.floor(params.page || 1));
    const limit = Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(params.limit || DEFAULT_PAGE_SIZE)));

    const url = this.buildUrl(`/${country}/search/${page}`, {
      app_id: this.appId,
      app_key: this.appKey,
      results_per_page: limit,
      what: params.query || undefined,
      where: params.location || undefined,
      salary_min: params.salaryMin || undefined,
      "content-type": "application/json",
      sort_by: "date",
    });

    const payload = await this.request<AdzunaResponse>(url, context, "search");
    const results = asArray<AdzunaResult>(payload.results);

    const normalized: NormalizedJob[] = [];
    for (const raw of results) {
      const job = this.normalizeResult(raw, country);
      if (!job) continue;
      if (params.remote && job.workplaceType !== "REMOTE") continue;
      normalized.push(job);
    }

    return normalized;
  }

  /**
   * Adzuna does not expose a public per-job lookup endpoint, so `getJob`
   * performs a targeted search and requires an exact id match. Callers that
   * already store the job (the feed/search APIs) resolve it from PostgreSQL via
   * `job-service` instead of hitting Adzuna.
   */
  public async getJob(
    externalId: string,
    context: ProviderContext = {}
  ): Promise<NormalizedJob | null> {
    if (!externalId) return null;
    try {
      const results = await this.search(
        { query: externalId, limit: MAX_PAGE_SIZE, page: 1 },
        context
      );
      return results.find((job) => job.externalId === String(externalId)) ?? null;
    } catch (error) {
      log.warn("adzuna getJob failed", { externalId, error: (error as Error).message });
      return null;
    }
  }

  /** Maps a raw Adzuna result onto the canonical job shape. */
  public normalizeResult(raw: AdzunaResult, country?: string): NormalizedJob | null {
    if (!raw || raw.id === undefined || raw.id === null) return null;

    const salary = normalizeSalary({
      min: raw.salary_min,
      max: raw.salary_max,
      currency: currencyForCountry(country || this.defaultCountry),
      interval: "YEAR",
      isPredicted: String(raw.salary_is_predicted ?? "") === "1" || raw.salary_is_predicted === true,
    });

    try {
      return buildNormalizedJob({
        provider: "ADZUNA",
        externalId: String(raw.id),
        title: raw.title,
        companyName: raw.company?.display_name,
        description: raw.description,
        location: raw.location?.display_name,
        employmentType:
          raw.contract_time || (raw.contract_type ? `${raw.contract_type}` : undefined),
        skills: [raw.category?.label || "", ...(raw.location?.area || []).slice(0, 2)],
        salary,
        postedAt: raw.created,
        sourceUrl: raw.redirect_url,
        applicationUrl: raw.redirect_url,
        applicationType: "MANUAL_REQUIRED",
        atsProvider: "MANUAL",
        rawData: {
          adzunaId: raw.id,
          category: raw.category?.label,
          categoryTag: raw.category?.tag,
          contractTime: raw.contract_time,
          contractType: raw.contract_type,
          latitude: raw.latitude,
          longitude: raw.longitude,
          salaryIsPredicted: salary.isPredicted ?? false,
        },
      });
    } catch (error) {
      log.debug("skipping malformed adzuna result", {
        id: raw.id,
        reason: (error as Error).message,
      });
      return null;
    }
  }

  /** Adzuna search across multiple pages. Bounded to protect API quota. */
  public async searchAll(
    params: JobSearchParams = {},
    context: ProviderContext = {},
    maxPages = 2
  ): Promise<NormalizedJob[]> {
    const out: NormalizedJob[] = [];
    const seen = new Set<string>();
    for (let page = 1; page <= Math.max(1, maxPages); page += 1) {
      const pageResults = await this.search({ ...params, page }, context);
      if (pageResults.length === 0) break;
      for (const job of pageResults) {
        if (seen.has(job.externalId)) continue;
        seen.add(job.externalId);
        out.push(job);
      }
      if (pageResults.length < Math.min(MAX_PAGE_SIZE, params.limit || DEFAULT_PAGE_SIZE)) break;
    }
    return out;
  }
}

const COUNTRY_CURRENCY: Record<string, string> = {
  gb: "GBP",
  us: "USD",
  ca: "CAD",
  au: "AUD",
  at: "EUR",
  de: "EUR",
  fr: "EUR",
  it: "EUR",
  es: "EUR",
  nl: "EUR",
  be: "EUR",
  ch: "CHF",
  in: "INR",
  nz: "NZD",
  za: "ZAR",
  br: "BRL",
  mx: "MXN",
  ng: "NGN",
  sg: "SGD",
  pl: "PLN",
};

export function currencyForCountry(country: string): string | undefined {
  return COUNTRY_CURRENCY[country?.toLowerCase()] || undefined;
}

export const adzunaAdapter = new AdzunaAdapter();
