/**
 * Provider contract for external job sources.
 *
 * Every provider (Adzuna, Greenhouse, Lever, …) implements `JobProvider` and
 * returns `NormalizedJob` records. The ingestion pipeline is provider agnostic:
 * adding a new source means adding an adapter + registering it in `./index.ts`,
 * never touching the core job system.
 *
 * Field mapping notes (provider shape -> ApplySwipe `Job` column):
 *   companyName  -> Job.company
 *   seniority    -> Job.seniority (legacy alias Job.experienceLevel)
 *   skills       -> Job.skills
 *   sourceUrl    -> Job.sourceUrl
 */

export type ProviderName = "ADZUNA" | "GREENHOUSE" | "LEVER";

export const PROVIDER_NAMES: ProviderName[] = ["ADZUNA", "GREENHOUSE", "LEVER"];

export type WorkplaceType = "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN";

export type SalaryInterval = "YEAR" | "MONTH" | "WEEK" | "DAY" | "HOUR";

export interface JobSearchParams {
  query?: string;
  location?: string;
  remote?: boolean;
  page?: number;
  limit?: number;
  /** Optional salary floor used by providers that support server-side filtering. */
  salaryMin?: number;
  /** Provider specific country code (Adzuna uses ISO country segments). */
  country?: string;
  /** Free-form provider options (e.g. Adzuna category filters). */
  options?: Record<string, string | number | boolean | undefined>;
}

export interface NormalizedJob {
  externalId: string;
  provider: string;

  title: string;
  companyName: string;
  companyLogo?: string;

  description: string;
  location?: string;
  /** Raw provider location string, preserved for transparency. */
  originalLocation?: string;

  workplaceType: WorkplaceType;

  employmentType?: string;
  seniority?: string;

  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryInterval?: SalaryInterval | string;
  /** True when the provider only predicts/estimates the salary. */
  salaryIsPredicted?: boolean;

  skills: string[];

  postedAt?: Date;
  expiresAt?: Date;

  sourceUrl: string;
  applicationUrl: string;

  /** ATS / automation capability hint derived from the provider. */
  applicationType?: "API_SUPPORTED" | "FORM_SUPPORTED" | "MANUAL_REQUIRED";
  atsProvider?: "GREENHOUSE" | "LEVER" | "WORKDAY" | "CUSTOM_API" | "MANUAL";

  rawData?: unknown;
}

/**
 * Database-backed source configuration (Greenhouse board token, Lever company slug).
 * Companies are configured through the admin API - never hard-coded in adapters.
 */
export interface JobSourceConfig {
  id?: string;
  provider: ProviderName;
  companyName: string;
  /** Greenhouse board token or Lever company slug. */
  boardToken: string;
  active?: boolean;
  config?: {
    /** Optional keyword filter applied after fetching the board. */
    query?: string;
    /** Only ingest jobs whose location matches one of these fragments. */
    locations?: string[];
    limit?: number;
  } | null;
}

export interface ProviderContext {
  /** Source configuration for board-style providers (Greenhouse / Lever). */
  source?: JobSourceConfig;
  /** Injectable fetch implementation (tests). */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
}

export interface JobProvider {
  readonly name: ProviderName;
  /** Human readable label used in the UI ("Source: Company Career Page"). */
  readonly label: string;
  /** True when the provider requires configured company sources from the database. */
  readonly requiresSource: boolean;
  /** True when the provider supports keyword search server-side. */
  readonly supportsSearch: boolean;

  search(params: JobSearchParams, context?: ProviderContext): Promise<NormalizedJob[]>;

  getJob(externalId: string, context?: ProviderContext): Promise<NormalizedJob | null>;
}

export interface ProviderInfo {
  name: ProviderName;
  label: string;
  requiresSource: boolean;
  supportsSearch: boolean;
  /** Env vars the provider requires before it can be enabled. */
  requiredEnv: string[];
  isConfigured: boolean;
}
