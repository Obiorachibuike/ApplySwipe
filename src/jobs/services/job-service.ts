import db from "@/lib/db";
import { isSafeExternalUrl } from "@/jobs/providers/http";
import { providerDescriptionToText, truncate } from "@/jobs/ingestion/normalize";
import { AGGREGATOR_DOMAINS } from "@/jobs/ingestion/deduplicate";
import { buildSearchText } from "@/jobs/ingestion/ingest";
import { jobSkills, scoreJob } from "@/jobs/matching/score";
import type { Job, JobSourceRef, MatchAnalysis } from "@/types";

/**
 * Job read/write service.
 *
 * All job lookups for the product go through here and hit ApplySwipe's own
 * normalized database - never a provider API. Provider APIs are only used by
 * the ingestion workers.
 */

export interface JobSearchFilters {
  query?: string;
  location?: string;
  remote?: boolean;
  workplaceType?: string;
  employmentType?: string;
  seniority?: string;
  salaryMin?: number;
  salaryMax?: number;
  skills?: string[];
  provider?: string;
  company?: string;
  postedAfter?: string | Date;
  includeInactive?: boolean;
}

export interface JobSearchOptions {
  page?: number;
  limit?: number;
  /** Optional viewer used to attach deterministic match scores. */
  viewerProfile?: import("@/types").Profile | null;
  viewerPreferences?: import("@/types").UserPreference | null;
}

export interface JobSearchResult {
  jobs: (Job & { matchScore?: number; matchAnalysis?: MatchAnalysis | null; sourceLabel: string })[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Number of jobs considered before filtering (diagnostics for the UI). */
  scanned: number;
}

export interface JobCounts {
  total: number;
  active: number;
  byProvider: Record<string, number>;
}

export function sourceLabelForProvider(provider: string | null | undefined, source?: string | null): string {
  switch (String(provider || "").toUpperCase()) {
    case "ADZUNA":
      return "Adzuna";
    case "GREENHOUSE":
      return "Company Career Page (Greenhouse)";
    case "LEVER":
      return "Company Career Page (Lever)";
    default:
      return source || "ApplySwipe";
  }
}

function isAggregatorUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return AGGREGATOR_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

/**
 * The URL the user should open to apply.
 *
 * Preference order: a company/ATS-hosted application URL (from any source that
 * advertised the opening), then the canonical job's own application URL. This is
 * how an Adzuna listing that is really a Greenhouse posting still sends the user
 * to the official employer application page.
 */
export function resolveOfficialApplicationUrl(job: Job): string | null {
  const refs = (Array.isArray(job.sources) ? job.sources : []) as JobSourceRef[];
  const refCandidates = refs
    .map((ref) => ref.applicationUrl)
    .filter((url): url is string => Boolean(url && isSafeExternalUrl(url)));

  const directRef = refCandidates.find((url) => !isAggregatorUrl(url));
  if (directRef) return directRef;

  if (job.applicationUrl && isSafeExternalUrl(job.applicationUrl)) return job.applicationUrl;
  const refFallback = refCandidates[0];
  if (refFallback) return refFallback;
  if (job.sourceUrl && isSafeExternalUrl(job.sourceUrl)) return job.sourceUrl;
  return null;
}

/** Rows that are merged duplicates must never surface as their own card. */
export function isDisplayable(job: Job): boolean {
  return Boolean(job.isActive) && !job.canonicalJobId && !job.isReported;
}

export interface PublicJob extends Job {
  sourceLabel: string;
  officialApplicationUrl: string | null;
  companyName: string;
}

/**
 * Client-safe serialization: sanitizes descriptions, validates every outbound
 * URL and drops provider `rawData` (which stays server-side for admin tooling).
 */
export function toPublicJob(job: Job): PublicJob {
  const description = providerDescriptionToText(job.description || "");

  const { rawData: _rawData, ...rest } = job;

  return {
    ...rest,
    description: truncate(description, 12000),
    skills: jobSkills(job),
    companyName: job.company,
    sourceLabel: sourceLabelForProvider(job.provider, job.source),
    officialApplicationUrl: resolveOfficialApplicationUrl(job),
    sourceUrl: isSafeExternalUrl(job.sourceUrl) ? job.sourceUrl : "",
    applicationUrl: isSafeExternalUrl(job.applicationUrl) ? job.applicationUrl : "",
    companyLogo: isSafeExternalUrl(job.companyLogo || "") ? job.companyLogo : null,
  };
}

function matchesFilters(job: Job, filters: JobSearchFilters): boolean {
  if (!filters.includeInactive && !job.isActive) return false;
  if (job.canonicalJobId && !filters.includeInactive) return false;

  if (filters.provider && String(job.provider || "").toUpperCase() !== filters.provider.toUpperCase())
    return false;

  if (filters.company && !job.company.toLowerCase().includes(filters.company.toLowerCase())) return false;

  if (filters.query) {
    const needle = filters.query.toLowerCase();
    const haystack = (
      job.searchText ||
      buildSearchText({
        title: job.title,
        company: job.company,
        location: job.location,
        skills: job.skills,
        employmentType: job.employmentType,
        workplaceType: job.workplaceType,
      })
    ).toLowerCase();
    const matchesText =
      haystack.includes(needle) ||
      (job.description || "").toLowerCase().includes(needle) ||
      job.title.toLowerCase().includes(needle);
    if (!matchesText) return false;
  }

  if (filters.location && !(job.location || "").toLowerCase().includes(filters.location.toLowerCase()))
    return false;

  if (filters.remote === true) {
    const workplace = String(job.workplaceType || "").toUpperCase();
    if (!(job.remote || workplace === "REMOTE")) return false;
  }
  if (filters.remote === false && (job.remote || String(job.workplaceType).toUpperCase() === "REMOTE")) {
    return false;
  }

  if (filters.workplaceType && String(job.workplaceType || "").toUpperCase() !== filters.workplaceType.toUpperCase())
    return false;

  if (
    filters.employmentType &&
    !(job.employmentType || "").toLowerCase().includes(filters.employmentType.toLowerCase())
  )
    return false;

  if (
    filters.seniority &&
    !String(job.seniority || job.experienceLevel || "")
      .toLowerCase()
      .includes(filters.seniority.toLowerCase())
  )
    return false;

  if (filters.salaryMin && job.salaryMax && job.salaryMax < filters.salaryMin) return false;
  if (filters.salaryMax && job.salaryMin && job.salaryMin > filters.salaryMax) return false;

  if (filters.skills?.length) {
    const jobSkillList = jobSkills(job).map((skill) => skill.toLowerCase());
    const hasAll = filters.skills.every((skill) =>
      jobSkillList.some((candidate) => candidate.includes(skill.toLowerCase()))
    );
    if (!hasAll) return false;
  }

  if (filters.postedAfter) {
    const threshold = new Date(filters.postedAfter).getTime();
    const posted = new Date(job.postedAt || job.createdAt).getTime();
    if (Number.isFinite(threshold) && Number.isFinite(posted) && posted < threshold) return false;
  }

  return true;
}

/** Searches the normalized job database. Never calls a provider. */
export async function searchJobs(
  filters: JobSearchFilters = {},
  options: JobSearchOptions = {}
): Promise<JobSearchResult> {
  const page = Math.max(1, Math.floor(options.page || 1));
  const limit = Math.max(1, Math.min(50, Math.floor(options.limit || 20)));

  const where: Record<string, unknown> = {};
  if (filters.provider) where.provider = filters.provider.toUpperCase();

  const allJobs = (await db.job.findMany({ where, orderBy: { postedAt: "desc" } })) as Job[];
  const scanned = allJobs.length;
  const filtered = allJobs.filter((job) => matchesFilters(job, filters));

  const start = (page - 1) * limit;
  const pageJobs = filtered.slice(start, start + limit);

  const jobs = pageJobs.map((job) => {
    const publicJob = toPublicJob(job);
    if (!options.viewerProfile) {
      return { ...publicJob, matchScore: undefined, matchAnalysis: null };
    }
    const match = scoreJob(options.viewerProfile, job, { preferences: options.viewerPreferences });
    return {
      ...publicJob,
      matchScore: match.score,
      matchAnalysis: {
        overallMatch: match.score,
        skillsMatch: match.breakdown.skills,
        experienceMatch: match.breakdown.experience,
        educationMatch: 0,
        locationMatch: match.breakdown.location,
        explanation: match.reason,
        matchingSkills: match.matchedSkills,
        missingSkills: match.missingSkills,
        concerns: match.concerns,
        breakdown: { ...match.breakdown },
        recommendation: match.recommendation,
      } as MatchAnalysis,
    };
  });

  return {
    jobs,
    total: filtered.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    scanned,
  };
}

export async function getJobById(jobId: string): Promise<Job | null> {
  return (await db.job.findUnique({ where: { id: jobId } })) as Job | null;
}

/** Finds a stored job by provider + external id (used by workers/admin tooling). */
export async function findJobByExternalId(
  provider: string,
  externalId: string
): Promise<Job | null> {
  return (await db.job.findFirst({
    where: { provider: provider.toUpperCase(), externalId: String(externalId) },
  })) as Job | null;
}

export async function recordJobView(userId: string, jobId: string): Promise<void> {
  const existing = await db.jobInteraction.findFirst({
    where: { userId, jobId, interactionType: "VIEWED" },
  });
  if (existing) return;
  await db.jobInteraction.create({
    data: { userId, jobId, interactionType: "VIEWED", metadata: { source: "job-detail" } },
  });
}

export async function jobCounts(): Promise<JobCounts> {
  const jobs = (await db.job.findMany({})) as Job[];
  const byProvider: Record<string, number> = {};
  let active = 0;

  for (const job of jobs) {
    const provider = String(job.provider || "LEGACY").toUpperCase();
    byProvider[provider] = (byProvider[provider] || 0) + 1;
    if (isDisplayable(job)) active += 1;
  }

  return { total: jobs.length, active, byProvider };
}

/** Duplicate rate diagnostics used by the admin job management page. */
export async function duplicateStats() {
  const jobs = (await db.job.findMany({})) as Job[];
  const merged = jobs.filter((job) => job.canonicalJobId);
  const multiSource = jobs.filter(
    (job) => Array.isArray(job.sources) && (job.sources as JobSourceRef[]).length > 1
  );
  const withFingerprint = jobs.filter((job) => Boolean(job.fingerprint));

  const fingerprintCounts = new Map<string, number>();
  for (const job of jobs) {
    if (!job.fingerprint) continue;
    fingerprintCounts.set(job.fingerprint, (fingerprintCounts.get(job.fingerprint) || 0) + 1);
  }
  const collisions = Array.from(fingerprintCounts.values()).filter((count) => count > 1).length;

  return {
    totalJobs: jobs.length,
    activeJobs: jobs.filter(isDisplayable).length,
    mergedDuplicates: merged.length,
    multiSourceJobs: multiSource.length,
    fingerprintCoverage: jobs.length === 0 ? 0 : Math.round((withFingerprint.length / jobs.length) * 100),
    crossProviderCollisions: collisions,
  };
}
