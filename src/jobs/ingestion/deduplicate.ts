import crypto from "crypto";
import { urlHost } from "@/jobs/providers/http";
import type { NormalizedJob } from "@/jobs/providers/types";
import type { JobSourceRef } from "@/types";

/**
 * Multi-level deduplication.
 *
 * Level 1 - provider + external id (the provider's own identity for the job).
 * Level 2 - fingerprint: company + normalized title + normalized location +
 *           application domain. This collapses the same opening advertised by
 *           Adzuna, a Greenhouse board and the company website into one
 *           canonical record while keeping every source reference.
 */

/** Domains that aggregate jobs from elsewhere and would break fingerprinting. */
export const AGGREGATOR_DOMAINS = [
  "adzuna.com",
  "adzuna.co.uk",
  "adzuna.de",
  "adzuna.fr",
  "adzuna.nl",
  "adzuna.com.au",
  "adzuna.ca",
  "adzuna.in",
  "indeed.com",
  "linkedin.com",
  "glassdoor.com",
  "ziprecruiter.com",
  "monster.com",
  "remoteok.com",
  "remoteok.io",
  "remotive.com",
  "weworkremotely.com",
  "wellfound.com",
  "angel.co",
  "jobs.github.com",
  "lever.co",
  "greenhouse.io",
  "workday.com",
  "smartrecruiters.com",
  "ashbyhq.com",
  "bamboohr.com",
  "recruitee.com",
  "personio.com",
  "workable.com",
  "jobvite.com",
  "icims.com",
  "taleo.net",
  "successfactors.com",
];

const COMPANY_SUFFIXES = [
  "inc",
  "inc.",
  "llc",
  "l.l.c.",
  "ltd",
  "ltd.",
  "limited",
  "plc",
  "gmbh",
  "ag",
  "sa",
  "s.a.",
  "sas",
  "bv",
  "b.v.",
  "nv",
  "oy",
  "ab",
  "as",
  "pty",
  "co",
  "co.",
  "corp",
  "corp.",
  "corporation",
  "company",
  "holdings",
  "group",
  "technologies",
  "technology",
  "labs",
  "software",
  "systems",
  "solutions",
  "global",
  "international",
];

const TITLE_NOISE = [
  "senior",
  "sr",
  "sr.",
  "junior",
  "jr",
  "jr.",
  "staff",
  "principal",
  "lead",
  "head",
  "chief",
  "intern",
  "internship",
  "trainee",
  "contract",
  "contractor",
  "remote",
  "hybrid",
  "onsite",
  "on-site",
  "full-time",
  "full time",
  "part-time",
  "part time",
  "permanent",
  "temporary",
  "urgent",
  "hiring",
  "immediately",
  "wanted",
  "needed",
  "f/m/d",
  "m/f/d",
  "m/w/d",
  "(m/w/x)",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Level 1 key: provider + external id. */
export function buildExternalKey(provider: string, externalId: string): string {
  return `${String(provider).toUpperCase()}:${String(externalId).trim()}`;
}

export function normalizeTitleForFingerprint(title: string): string {
  let value = (title || "")
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(remote|hybrid|onsite|on-site)\b/g, " ");

  for (const noise of TITLE_NOISE) {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(noise)}([^a-z0-9]|$)`, "gi");
    value = value.replace(pattern, " ");
  }

  return value
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCompanyForKey(company: string): string {
  let value = (company || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ");
  value = value.replace(/\s+/g, " ").trim();

  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of COMPANY_SUFFIXES) {
      if (value.endsWith(` ${suffix}`)) {
        value = value.slice(0, -(suffix.length + 1)).trim();
        changed = true;
      }
    }
  }

  return value.replace(/\s+/g, "");
}

/**
 * Location key for fingerprinting. Remote jobs collapse to a single key so
 * "Remote", "Work from anywhere" and "Remote - US" are treated as the same
 * workplace for the same company + title.
 */
export function locationKeyForFingerprint(location: string | null | undefined): string {
  const value = (location || "").toLowerCase();
  if (!value) return "unspecified";
  if (/remote|anywhere|work from home|distributed|telecommute|wfh/.test(value)) return "remote";
  if (/hybrid|partially remote|part remote/.test(value)) return "hybrid";
  return value
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAggregatorHost(host: string): boolean {
  return AGGREGATOR_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/**
 * Application domain used in the fingerprint. Aggregators and ATS hosts are
 * ignored (they are shared by thousands of unrelated companies), otherwise the
 * company's own domain is used.
 */
export function applicationDomain(url?: string | null): string {
  const host = urlHost(url);
  if (!host) return "";
  if (isAggregatorHost(host)) return "";
  return host.replace(/^www\./, "");
}

export function computeFingerprint(input: {
  companyName?: string | null;
  title?: string | null;
  location?: string | null;
  applicationUrl?: string | null;
}): string {
  const parts = [
    normalizeCompanyForKey(input.companyName || ""),
    normalizeTitleForFingerprint(input.title || ""),
    locationKeyForFingerprint(input.location),
    applicationDomain(input.applicationUrl),
  ].join("|");

  return crypto.createHash("sha256").update(parts).digest("hex").slice(0, 40);
}

export function fingerprintForJob(job: NormalizedJob): string {
  return computeFingerprint({
    companyName: job.companyName,
    title: job.title,
    location: job.location,
    applicationUrl: job.applicationUrl || job.sourceUrl,
  });
}

export interface DedupeCandidate {
  id: string;
  provider: string;
  externalId?: string | null;
  fingerprint?: string | null;
  isActive?: boolean;
  canonicalJobId?: string | null;
  sources?: JobSourceRef[] | null;
}

export interface DedupeLookup {
  /** Level 1 match (same provider + external id). */
  externalMatch?: DedupeCandidate;
  /** Level 2 match (same job from another provider/source). */
  fingerprintMatch?: DedupeCandidate;
}

/** Resolves the existing records a normalized job collides with. */
export function findDuplicates(
  job: NormalizedJob,
  knownJobs: DedupeCandidate[],
  fingerprint = fingerprintForJob(job)
): DedupeLookup {
  const provider = job.provider.toUpperCase();
  const externalId = String(job.externalId);

  const externalMatch = knownJobs.find(
    (candidate) =>
      String(candidate.provider || "").toUpperCase() === provider &&
      String(candidate.externalId || "") === externalId
  );

  const fingerprintMatch = knownJobs.find(
    (candidate) =>
      candidate.id !== externalMatch?.id &&
      candidate.fingerprint === fingerprint &&
      !candidate.canonicalJobId &&
      candidate.isActive !== false
  );

  return { externalMatch, fingerprintMatch };
}

/** Adds/updates the list of source references kept on the canonical job. */
export function mergeSourceRef(
  existing: JobSourceRef[] | null | undefined,
  ref: JobSourceRef
): JobSourceRef[] {
  const refs = Array.isArray(existing) ? [...existing] : [];
  const index = refs.findIndex(
    (entry) =>
      entry.provider?.toUpperCase() === ref.provider?.toUpperCase() &&
      String(entry.externalId) === String(ref.externalId)
  );

  if (index === -1) {
    refs.push(ref);
  } else {
    refs[index] = {
      ...refs[index],
      ...ref,
      firstSeenAt: refs[index].firstSeenAt || ref.firstSeenAt,
    };
  }

  return refs.slice(0, 10);
}

/** Confidence score for a fingerprint collision (used by admin tooling). */
export function duplicateConfidence(a: DedupeCandidate, b: NormalizedJob): number {
  if (a.fingerprint && a.fingerprint === fingerprintForJob(b)) return 1;
  return 0;
}
