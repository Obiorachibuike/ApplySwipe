/**
 * One-off (idempotent) backfill for data that predates the multi-source
 * ingestion upgrade - the equivalent of the SQL backfill in
 * prisma/migrations/20261004000100_job_ingestion_upgrade.
 *
 *   npm run jobs:backfill
 *   npx tsx scripts/backfill-jobs.ts --dry-run
 *
 * What it does (never deletes anything):
 *   - labels legacy jobs with provider = LEGACY and derives workplaceType,
 *     sourceUrl, firstSeenAt/lastSeenAt, seniority and salaryInterval
 *   - computes the level-2 dedupe fingerprint + denormalized searchText
 *   - canonicalizes / extracts skills where the provider gave none
 *   - seeds ProviderState rows so the admin health monitor has a baseline
 *   - infers job source providers (Greenhouse / Lever / Adzuna) from their names
 */
import db from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { Job, JobSource, JobSourceRef } from "@/types";
import { buildSearchText } from "@/jobs/ingestion/ingest";
import { computeFingerprint } from "@/jobs/ingestion/deduplicate";
import { extractSkills } from "@/jobs/matching/skills";
import { normalizeLocation, normalizeWorkplaceType } from "@/jobs/ingestion/normalize";
import { getProviderState } from "@/jobs/ingestion/provider-state";
import { getProviderInfo } from "@/jobs/providers";

const log = createLogger("scripts:backfill");

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, value] = raw.replace(/^--/, "").split("=");
    args[key] = value === undefined ? true : value;
  }
  return args;
}

function inferProvider(job: Job): string {
  const explicit = String(job.provider || "").toUpperCase();
  if (explicit && explicit !== "LEGACY") return explicit;

  const source = String(job.source || "").toLowerCase();
  if (source.includes("adzuna")) return "ADZUNA";
  if (source.includes("greenhouse")) return "GREENHOUSE";
  if (source.includes("lever")) return "LEVER";

  const ats = String(job.atsProvider || "").toUpperCase();
  if (ats === "GREENHOUSE" || ats === "LEVER") return ats;
  return "LEGACY";
}

async function backfillJobs(dryRun: boolean) {
  const jobs = (await db.job.findMany({})) as Job[];
  const now = new Date().toISOString();
  let updated = 0;

  for (const job of jobs) {
    const provider = inferProvider(job);
    const locationInfo = normalizeLocation(job.location);
    const workplaceType =
      job.workplaceType && job.workplaceType !== "UNKNOWN"
        ? job.workplaceType
        : normalizeWorkplaceType({
            remoteFlag: job.remote,
            location: job.location,
            description: job.description,
          });

    const skills =
      Array.isArray(job.skills) && job.skills.length > 0
        ? job.skills
        : extractSkills(`${job.title}\n${job.description || ""}`, { limit: 20 });

    const fingerprint =
      job.fingerprint ||
      computeFingerprint({
        companyName: job.company,
        title: job.title,
        location: job.location,
        applicationUrl: job.applicationUrl,
      });

    const sources: JobSourceRef[] =
      Array.isArray(job.sources) && job.sources.length > 0
        ? job.sources
        : [
            {
              provider,
              externalId: String(job.externalId || job.id),
              sourceUrl: job.sourceUrl || job.applicationUrl,
              applicationUrl: job.applicationUrl,
              firstSeenAt: job.createdAt || now,
              lastSeenAt: job.lastSeenAt || job.updatedAt || now,
            },
          ];

    const data = {
      provider,
      workplaceType,
      originalLocation: job.originalLocation || (locationInfo.display === job.location ? null : locationInfo.display),
      sourceUrl: job.sourceUrl || job.applicationUrl,
      seniority: job.seniority || job.experienceLevel || null,
      salaryInterval: job.salaryInterval || (job.salaryMin || job.salaryMax ? "YEAR" : null),
      firstSeenAt: job.firstSeenAt || job.createdAt || now,
      lastSeenAt: job.lastSeenAt || job.updatedAt || now,
      seenCount: job.seenCount || 1,
      fingerprint,
      sources,
      skills,
      searchText: buildSearchText({
        title: job.title,
        company: job.company,
        location: job.location,
        skills,
        employmentType: job.employmentType,
        workplaceType,
      }),
      remote: workplaceType === "REMOTE" ? true : job.remote,
    };

    const needsUpdate = Object.entries(data).some(
      ([key, value]) => JSON.stringify((job as unknown as Record<string, unknown>)[key] ?? null) !== JSON.stringify(value ?? null)
    );

    if (!needsUpdate) continue;
    updated += 1;

    if (!dryRun) {
      await db.job.update({ where: { id: job.id }, data });
    }
  }

  return { scanned: jobs.length, updated };
}

async function backfillSources(dryRun: boolean) {
  const sources = (await db.jobSource.findMany({})) as JobSource[];
  let updated = 0;

  for (const source of sources) {
    const name = String(source.name || "").toLowerCase();
    const provider =
      String(source.provider || "").toUpperCase() ||
      (name.includes("adzuna")
        ? "ADZUNA"
        : name.includes("greenhouse")
        ? "GREENHOUSE"
        : name.includes("lever")
        ? "LEVER"
        : null);

    const data = {
      provider,
      companyName: source.companyName || source.name,
      boardToken: source.boardToken || null,
      active: source.active ?? source.isActive !== false,
      isActive: source.active ?? source.isActive !== false,
      jobsImported: source.jobsImported || source.jobCount || 0,
      lastSuccessAt: source.lastSuccessAt || source.lastSyncAt || null,
    };

    const needsUpdate = Object.entries(data).some(
      ([key, value]) => JSON.stringify((source as unknown as Record<string, unknown>)[key] ?? null) !== JSON.stringify(value ?? null)
    );
    if (!needsUpdate) continue;

    updated += 1;
    if (!dryRun) {
      await db.jobSource.update({ where: { id: source.id }, data });
    }
  }

  return { scanned: sources.length, updated };
}

async function ensureProviderStates(dryRun: boolean) {
  const created: string[] = [];
  for (const info of getProviderInfo()) {
    const existing = await db.providerState.findFirst({ where: { provider: info.name } });
    if (existing) continue;
    created.push(info.name);
    if (!dryRun) {
      await getProviderState(info.name);
    }
  }
  return created;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args["dry-run"] === true;

  const jobs = await backfillJobs(dryRun);
  const sources = await backfillSources(dryRun);
  const providers = await ensureProviderStates(dryRun);

  console.log("\n=== Job backfill ===");
  console.log(
    JSON.stringify(
      {
        dryRun,
        jobs,
        jobSources: sources,
        providerStatesCreated: providers,
      },
      null,
      2
    )
  );

  log.info("backfill finished", { dryRun, jobs, sources });
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
