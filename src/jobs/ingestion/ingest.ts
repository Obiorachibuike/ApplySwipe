import db from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getProvider, isProviderConfigured, listProviders } from "@/jobs/providers";
import { isSafeExternalUrl } from "@/jobs/providers/http";
import type { JobSearchParams, JobSourceConfig, NormalizedJob } from "@/jobs/providers/types";
import type { Job, JobSourceRef } from "@/types";
import {
  applicationDomain,
  fingerprintForJob,
  mergeSourceRef,
} from "./deduplicate";
import { freshnessHours, staleReason } from "./freshness";
import {
  acquireProviderLock,
  finishSyncRun,
  markProviderFailure,
  markProviderSuccess,
  newLockOwner,
  releaseProviderLock,
  startSyncRun,
} from "./provider-state";

const log = createLogger("jobs:ingest");

export interface IngestStats {
  provider: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
  fetched: number;
  inserted: number;
  updated: number;
  duplicates: number;
  failed: number;
  deactivated: number;
  sourcesProcessed: number;
  sourcesFailed: number;
  errors: { source?: string; message: string }[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface IngestOptions {
  triggeredBy?: string;
  /** Limit how many job sources are processed in this run (quota control). */
  maxSources?: number;
  /** Hard cap of jobs upserted per source (protects API quota + runtime). */
  limitPerSource?: number;
  /** Extra search params merged into every provider search. */
  searchParams?: JobSearchParams;
  /** Dry run: fetch + normalize, never write. */
  dryRun?: boolean;
  /**
   * Injectable fetch implementation. Production always uses global fetch; tests
   * inject a mocked transport so the full pipeline can run offline.
   */
  fetchImpl?: typeof fetch;
  /** Skip expiry sweep (default: stale jobs seen during this sync are deactivated). */
  skipExpiry?: boolean;
}

/** Label used for the human readable `Job.source` column. */
export function sourceLabelFor(provider: string): string {
  switch (String(provider).toUpperCase()) {
    case "ADZUNA":
      return "Adzuna";
    case "GREENHOUSE":
      return "Company Career Page (Greenhouse)";
    case "LEVER":
      return "Company Career Page (Lever)";
    default:
      return "ApplySwipe Feed";
  }
}

/** Lowercased denormalized blob used for fast database-side keyword search. */
export function buildSearchText(job: {
  title?: string | null;
  company?: string | null;
  location?: string | null;
  skills?: string[] | null;
  employmentType?: string | null;
  workplaceType?: string | null;
}): string {
  return [
    job.title,
    job.company,
    job.location,
    (job.skills || []).join(" "),
    job.employmentType,
    job.workplaceType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .slice(0, 4000);
}

function inferAts(job: NormalizedJob): Job["atsProvider"] {
  if (job.atsProvider) return job.atsProvider;
  const provider = job.provider.toUpperCase();
  if (provider === "GREENHOUSE") return "GREENHOUSE";
  if (provider === "LEVER") return "LEVER";
  const host = applicationDomain(job.applicationUrl) || applicationDomain(job.sourceUrl);
  if (host.includes("greenhouse")) return "GREENHOUSE";
  if (host.includes("lever.co")) return "LEVER";
  if (host.includes("workday")) return "WORKDAY";
  return "MANUAL";
}

function inferApplicationType(job: NormalizedJob): Job["applicationType"] {
  if (job.applicationType) return job.applicationType;
  const ats = inferAts(job);
  if (ats === "GREENHOUSE" || ats === "LEVER") return "API_SUPPORTED";
  return "MANUAL_REQUIRED";
}

/** Maps a normalized job onto the columns of the existing `Job` model. */
export function toJobRecord(job: NormalizedJob): Partial<Job> {
  const now = new Date().toISOString();
  const postedAt = (job.postedAt || new Date()).toISOString();
  const atsProvider = inferAts(job);

  return {
    externalId: job.externalId,
    provider: job.provider.toUpperCase(),
    source: sourceLabelFor(job.provider),
    title: job.title,
    company: job.companyName,
    companyLogo: job.companyLogo || null,
    description: job.description,
    location: job.location || "Location not specified",
    originalLocation: job.originalLocation || job.location || null,
    remote: job.workplaceType === "REMOTE",
    workplaceType: job.workplaceType,
    employmentType: job.employmentType || "Full-time",
    seniority: job.seniority || null,
    experienceLevel: job.seniority || "Mid",
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    salaryCurrency: job.salaryCurrency || "USD",
    salaryInterval: job.salaryInterval || (job.salaryMin || job.salaryMax ? "YEAR" : null),
    salaryIsPredicted: job.salaryIsPredicted ?? null,
    skills: job.skills || [],
    searchText: buildSearchText({
      title: job.title,
      company: job.companyName,
      location: job.location,
      skills: job.skills,
      employmentType: job.employmentType,
      workplaceType: job.workplaceType,
    }),
    sourceUrl: job.sourceUrl,
    applicationUrl: job.applicationUrl,
    applicationType: inferApplicationType(job),
    atsProvider,
    isReported: false,
    isActive: true,
    fingerprint: fingerprintForJob(job),
    postedAt,
    expiresAt: job.expiresAt ? job.expiresAt.toISOString() : null,
    firstSeenAt: now,
    lastSeenAt: now,
    seenCount: 1,
    rawData: job.rawData ?? null,
  };
}

export interface UpsertResult {
  status: "inserted" | "updated" | "duplicate";
  jobId: string;
  canonicalJobId?: string;
}

function sourceRefFor(job: NormalizedJob): JobSourceRef {
  const now = new Date().toISOString();
  return {
    provider: job.provider.toUpperCase(),
    externalId: String(job.externalId),
    sourceUrl: job.sourceUrl,
    applicationUrl: job.applicationUrl,
    firstSeenAt: now,
    lastSeenAt: now,
  };
}

function pickImprovedValue<T>(current: T | null | undefined, incoming: T | undefined): T | undefined {
  if (incoming === undefined || incoming === null || incoming === "") return undefined;
  if (current === undefined || current === null || current === "") return incoming;
  return undefined;
}

/**
 * Upserts one normalized job.
 *
 * Level 1 - same provider + external id  -> update in place (keeps swipes,
 *           saved jobs, applications and resume versions attached).
 * Level 2 - same fingerprint, other provider -> merge into the canonical row
 *           and record the additional source instead of creating a duplicate.
 */
export async function upsertNormalizedJob(
  job: NormalizedJob,
  options: { dryRun?: boolean } = {}
): Promise<UpsertResult> {
  const provider = job.provider.toUpperCase();
  const fingerprint = fingerprintForJob(job);

  const existing = (await db.job.findFirst({
    where: { provider, externalId: String(job.externalId) },
  })) as Job | null;

  const record = toJobRecord(job);

  if (existing) {
    if (options.dryRun) return { status: "updated", jobId: existing.id };

    const wasMerged = Boolean(existing.canonicalJobId);
    const update: Record<string, unknown> = {
      ...record,
      firstSeenAt: existing.firstSeenAt || record.firstSeenAt,
      seenCount: (existing.seenCount || 0) + 1,
      lastSeenAt: new Date().toISOString(),
      // A job merged into another record must stay hidden from the feed.
      isActive: wasMerged ? false : true,
      canonicalJobId: existing.canonicalJobId || null,
      postedAt: job.postedAt ? job.postedAt.toISOString() : existing.postedAt,
      sources: mergeSourceRef(existing.sources as JobSourceRef[] | null, sourceRefFor(job)),
    };

    // Preserve richer data that the incoming provider may not expose.
    if (!job.expiresAt && existing.expiresAt) update.expiresAt = existing.expiresAt;
    if (!job.salaryMax && existing.salaryMax) {
      update.salaryMin = existing.salaryMin;
      update.salaryMax = existing.salaryMax;
      update.salaryCurrency = existing.salaryCurrency;
      update.salaryInterval = existing.salaryInterval;
    }
    if (existing.skills?.length && (!job.skills || job.skills.length === 0)) {
      update.skills = existing.skills;
      update.searchText = existing.searchText;
    }

    const updated = (await db.job.update({ where: { id: existing.id }, data: update })) as Job;
    return { status: "updated", jobId: updated.id };
  }

  // Level 2: fingerprint collision with a job from another provider.
  const canonical = (await db.job.findFirst({
    where: { fingerprint, isActive: true },
  })) as Job | null;

  if (canonical) {
    if (!options.dryRun) {
      const alreadyMerged = (await db.job.findFirst({
        where: { provider, externalId: String(job.externalId) },
      })) as Job | null;

      const update: Record<string, unknown> = {
        sources: mergeSourceRef(canonical.sources as JobSourceRef[] | null, sourceRefFor(job)),
        lastSeenAt: new Date().toISOString(),
        seenCount: (canonical.seenCount || 0) + 1,
      };

      // Opportunistically fill gaps on the canonical record (never overwrite).
      const richerSalary = pickImprovedValue(canonical.salaryMin, job.salaryMin);
      if (richerSalary !== undefined) {
        update.salaryMin = job.salaryMin ?? null;
        update.salaryMax = job.salaryMax ?? null;
        update.salaryCurrency = job.salaryCurrency || canonical.salaryCurrency;
        update.salaryInterval = job.salaryInterval || canonical.salaryInterval;
      }
      const richerDescription = pickImprovedValue(canonical.description?.length, job.description.length);
      if (richerDescription !== undefined && job.description.length > (canonical.description?.length || 0)) {
        update.description = job.description;
      }
      if (!canonical.skills?.length && job.skills?.length) {
        update.skills = job.skills;
        update.searchText = buildSearchText({
          title: canonical.title,
          company: canonical.company,
          location: canonical.location,
          skills: job.skills,
          employmentType: canonical.employmentType,
          workplaceType: canonical.workplaceType,
        });
      }

      await db.job.update({ where: { id: canonical.id }, data: update });

      if (alreadyMerged && alreadyMerged.id !== canonical.id) {
        await db.job.update({
          where: { id: alreadyMerged.id },
          data: { isActive: false, canonicalJobId: canonical.id },
        });
      }
    }

    return { status: "duplicate", jobId: canonical.id, canonicalJobId: canonical.id };
  }

  if (options.dryRun) return { status: "inserted", jobId: "dry-run" };

  const created = (await db.job.create({
    data: { ...record, sources: [sourceRefFor(job)] },
  })) as Job;

  return { status: "inserted", jobId: created.id };
}

/** Configured sources for a provider (Greenhouse boards, Lever companies, Adzuna profiles). */
export async function loadJobSources(provider: string): Promise<JobSourceConfig[]> {
  const rows = (await db.jobSource.findMany({ where: { provider: provider.toUpperCase() } })) as Array<{
    id: string;
    provider?: string | null;
    companyName?: string | null;
    name?: string;
    boardToken?: string | null;
    active?: boolean;
    isActive?: boolean;
    config?: Record<string, unknown> | null;
  }>;

  return rows
    .filter((row) => row.active !== false && row.isActive !== false)
    .filter((row) => Boolean(row.boardToken || (row.config && (row.config.query || row.config.locations))))
    .map((row) => ({
      id: row.id,
      provider: provider.toUpperCase() as JobSourceConfig["provider"],
      companyName: row.companyName || row.name || "Unknown company",
      boardToken: row.boardToken || "",
      active: true,
      config: (row.config as JobSourceConfig["config"]) || null,
    }));
}

/** Default Adzuna search profile used when no explicit profiles are configured. */
function defaultAdzunaProfile(): JobSourceConfig {
  const query = process.env.ADZUNA_DEFAULT_QUERY || "software engineer";
  return {
    provider: "ADZUNA",
    companyName: "Adzuna",
    boardToken: "",
    active: true,
    config: {
      query,
      locations: process.env.ADZUNA_DEFAULT_LOCATION ? [process.env.ADZUNA_DEFAULT_LOCATION] : undefined,
      limit: Number(process.env.ADZUNA_MAX_PAGES_PER_SYNC || 2) * 50,
    },
  };
}

export function emptyStats(provider: string): IngestStats {
  const now = new Date().toISOString();
  return {
    provider,
    status: "SUCCESS",
    fetched: 0,
    inserted: 0,
    updated: 0,
    duplicates: 0,
    failed: 0,
    deactivated: 0,
    sourcesProcessed: 0,
    sourcesFailed: 0,
    errors: [],
    startedAt: now,
    finishedAt: now,
    durationMs: 0,
  };
}

/** Search params derived from a source configuration profile. */
function paramsForSource(provider: string, source: JobSourceConfig): JobSearchParams {
  const config = source.config || {};
  const limit = config.limit || (provider === "ADZUNA" ? 50 : undefined);
  return {
    query: config.query,
    location: config.locations?.[0],
    limit,
    page: 1,
    country: undefined,
  };
}

/** Sweeps jobs that have not been seen for their provider's freshness window. */
export async function deactivateStaleJobsForProvider(
  provider: string,
  stats: IngestStats
): Promise<number> {
  const now = new Date();
  const jobs = (await db.job.findMany({
    where: { provider: provider.toUpperCase(), isActive: true },
  })) as Job[];

  let deactivated = 0;
  for (const job of jobs) {
    if (job.canonicalJobId) continue;
    const reason = staleReason(job, now);
    if (!reason) continue;
    if (reason === "NOT_SEEN" && (job.seenCount || 0) < 2 && job.lastSeenAt) {
      // Newly discovered jobs get one full freshness window before deactivation.
      const firstSeen = new Date(job.firstSeenAt || job.lastSeenAt || job.createdAt).getTime();
      if (now.getTime() - firstSeen < freshnessHours(provider) * 60 * 60 * 1000) continue;
    }
    await db.job.update({ where: { id: job.id }, data: { isActive: false } });
    deactivated += 1;
  }

  stats.deactivated += deactivated;
  return deactivated;
}

/**
 * Ingests a single provider.
 *
 * Provider failures never propagate: they are recorded on the provider health
 * state and reported in the returned statistics so the remaining providers
 * (and the rest of ApplySwipe) keep working.
 */
export async function ingestProvider(
  providerName: string,
  options: IngestOptions = {}
): Promise<IngestStats> {
  const provider = String(providerName).toUpperCase();
  const stats = emptyStats(provider);
  const startedAt = Date.now();
  const owner = newLockOwner("ingest");
  const triggeredBy = options.triggeredBy || "scheduler";

  const providerImpl = getProvider(provider);

  if (!isProviderConfigured(providerImpl.name)) {
    stats.status = "SKIPPED";
    stats.errors.push({
      message: `${provider} is not configured (missing ${provider === "ADZUNA" ? "ADZUNA_APP_ID / ADZUNA_APP_KEY" : "credentials"})`,
    });
    stats.finishedAt = new Date().toISOString();
    stats.durationMs = Date.now() - startedAt;
    log.warn("provider skipped - not configured", { provider });
    return stats;
  }

  const locked = await acquireProviderLock(provider, owner);
  if (!locked) {
    stats.status = "SKIPPED";
    stats.errors.push({ message: `${provider} sync already running (locked)` });
    stats.finishedAt = new Date().toISOString();
    stats.durationMs = Date.now() - startedAt;
    log.warn("provider sync skipped - lock held", { provider });
    return stats;
  }

  const run = await startSyncRun(provider, triggeredBy);

  try {
    const sources =
      provider === "ADZUNA"
        ? (await loadJobSources("ADZUNA")).length > 0
          ? await loadJobSources("ADZUNA")
          : [defaultAdzunaProfile()]
        : await loadJobSources(provider);

    if (providerImpl.requiresSource && sources.length === 0) {
      stats.status = "SKIPPED";
      stats.errors.push({
        message: `No active ${provider} companies configured. Add one in the admin job sources page.`,
      });
      await finishSyncRun(run.id, "SKIPPED", stats);
      await markProviderSuccess(provider, {});
      return stats;
    }

    const limitedSources =
      options.maxSources && options.maxSources > 0 ? sources.slice(0, options.maxSources) : sources;

    for (const source of limitedSources) {
      stats.sourcesProcessed += 1;
      try {
        const params: JobSearchParams = {
          ...paramsForSource(provider, source),
          ...options.searchParams,
        };
        if (options.limitPerSource) params.limit = options.limitPerSource;

        const normalized = await providerImpl.search(params, { source, fetchImpl: options.fetchImpl });
        stats.fetched += normalized.length;

        for (const job of normalized) {
          try {
            const result = await upsertNormalizedJob(job, { dryRun: options.dryRun });
            if (result.status === "inserted") stats.inserted += 1;
            else if (result.status === "updated") stats.updated += 1;
            else stats.duplicates += 1;
          } catch (error) {
            stats.failed += 1;
            log.warn("failed to upsert job", {
              provider,
              externalId: job.externalId,
              error: (error as Error).message,
            });
          }
        }

        if (!options.dryRun && source.id) {
          try {
            await db.jobSource.update({
              where: { id: source.id },
              data: {
                lastSyncAt: new Date().toISOString(),
                lastSuccessAt: new Date().toISOString(),
                lastError: null,
                jobsImported: stats.inserted + stats.updated + stats.duplicates,
                jobCount: stats.inserted + stats.updated + stats.duplicates,
              },
            });
          } catch (error) {
            log.warn("failed to update job source sync state", {
              sourceId: source.id,
              error: (error as Error).message,
            });
          }
        }
      } catch (error) {
        stats.sourcesFailed += 1;
        stats.failed += 1;
        const message = (error as Error).message || "Unknown provider error";
        stats.errors.push({ source: source.companyName || source.boardToken || provider, message });
        log.error("source sync failed", {
          provider,
          source: source.companyName,
          error: message,
        });

        if (source.id && !options.dryRun) {
          try {
            await db.jobSource.update({
              where: { id: source.id },
              data: {
                lastSyncAt: new Date().toISOString(),
                lastErrorAt: new Date().toISOString(),
                lastError: message.slice(0, 500),
              },
            });
          } catch (sourceError) {
            log.warn("failed to record source sync error", {
              sourceId: source.id,
              error: (sourceError as Error).message,
            });
          }
        }
      }
    }

    if (!options.dryRun && !options.skipExpiry) {
      await deactivateStaleJobsForProvider(provider, stats);
    }

    const activeJobs = await db.job.count({ where: { provider, isActive: true } });

    if (stats.sourcesFailed > 0) {
      stats.status = stats.sourcesProcessed === stats.sourcesFailed ? "FAILED" : "PARTIAL";
    } else {
      stats.status = "SUCCESS";
    }

    if (!options.dryRun) {
      if (stats.status === "FAILED") {
        await markProviderFailure(provider, new Error(stats.errors[0]?.message || "sync failed"));
      } else {
        await markProviderSuccess(provider, {
          jobsImported: stats.inserted + stats.updated + stats.duplicates,
          activeJobs,
        });
      }
    }

    await finishSyncRun(run.id, stats.status, stats, stats.errors[0]?.message || undefined);
    return stats;
  } catch (error) {
    stats.status = "FAILED";
    stats.errors.push({ message: (error as Error).message || "Unknown ingestion error" });
    await markProviderFailure(provider, error);
    await finishSyncRun(run.id, "FAILED", stats, (error as Error).message || undefined);
    return stats;
  } finally {
    stats.finishedAt = new Date().toISOString();
    stats.durationMs = Date.now() - startedAt;
    await releaseProviderLock(provider, owner);
  }
}

export interface IngestAllResult {
  providers: IngestStats[];
  totals: {
    fetched: number;
    inserted: number;
    updated: number;
    duplicates: number;
    failed: number;
    deactivated: number;
  };
}

/** Ingests every provider. One provider failing never blocks the others. */
export async function ingestAllProviders(options: IngestOptions = {}): Promise<IngestAllResult> {
  const providers = listProviders();
  const results: IngestStats[] = [];

  for (const provider of providers) {
    try {
      results.push(await ingestProvider(provider, options));
    } catch (error) {
      // ingestProvider already traps errors, this is belt-and-braces.
      const stats = emptyStats(provider);
      stats.status = "FAILED";
      stats.errors.push({ message: (error as Error).message });
      results.push(stats);
    }
  }

  const totals = results.reduce(
    (acc, stats) => ({
      fetched: acc.fetched + stats.fetched,
      inserted: acc.inserted + stats.inserted,
      updated: acc.updated + stats.updated,
      duplicates: acc.duplicates + stats.duplicates,
      failed: acc.failed + stats.failed,
      deactivated: acc.deactivated + stats.deactivated,
    }),
    { fetched: 0, inserted: 0, updated: 0, duplicates: 0, failed: 0, deactivated: 0 }
  );

  return { providers: results, totals };
}

/** Compact shape for the admin API / worker logs. */
export function summarizeStats(stats: IngestStats) {
  return {
    provider: stats.provider,
    status: stats.status,
    fetched: stats.fetched,
    inserted: stats.inserted,
    updated: stats.updated,
    duplicates: stats.duplicates,
    failed: stats.failed,
    deactivated: stats.deactivated,
    durationMs: stats.durationMs,
    sourcesProcessed: stats.sourcesProcessed,
    errors: stats.errors.slice(0, 5),
  };
}

export { isSafeExternalUrl };
