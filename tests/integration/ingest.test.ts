import { afterAll, beforeAll, describe, expect, it } from "vitest";
import db from "@/lib/db";
import {
  buildSearchText,
  deactivateStaleJobsForProvider,
  emptyStats,
  toJobRecord,
  upsertNormalizedJob,
} from "@/jobs/ingestion/ingest";
import { buildNormalizedJob } from "@/jobs/ingestion/normalize";
import { fingerprintForJob } from "@/jobs/ingestion/deduplicate";
import { freshnessHours } from "@/jobs/ingestion/freshness";
import type { Job } from "@/types";

const PROVIDER = "GREENHOUSE";
const EXTERNAL_ID = "test-ingest-4091";

function normalized(overrides: Record<string, unknown> = {}) {
  return buildNormalizedJob({
    provider: PROVIDER,
    externalId: EXTERNAL_ID,
    title: "Senior Full Stack Engineer",
    companyName: "Ingest Test Inc",
    description:
      "Build collaboration software with React, TypeScript, Node.js and PostgreSQL. Fully remote within the EU.",
    location: "Remote - EU",
    employmentType: "Full-time",
    skills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
    salary: { min: 150000, max: 190000, currency: "USD", interval: "year" },
    postedAt: new Date().toISOString(),
    sourceUrl: "https://boards.greenhouse.io/ingesttest/jobs/4091",
    applicationUrl: "https://boards.greenhouse.io/ingesttest/jobs/4091",
    applicationType: "API_SUPPORTED",
    atsProvider: "GREENHOUSE",
    ...overrides,
  });
}

async function cleanup() {
  const jobs = (await db.job.findMany({
    where: { company: { contains: "Ingest Test" } },
  })) as Job[];
  if (jobs.length > 0) {
    await db.job.deleteMany({ where: { id: { in: jobs.map((job) => job.id) } } });
  }
}

beforeAll(cleanup);
afterAll(cleanup);

describe("ingestion upserts", () => {
  it("builds a searchable record without leaking provider raw data into search text", () => {
    const record = toJobRecord(normalized());
    expect(record.searchText).toBeTruthy();
    expect(buildSearchText(record as Partial<Job>)).toContain("react");
  });

  it("inserts a new job with fingerprint and source reference", async () => {
    const job = normalized();
    const result = await upsertNormalizedJob(job);

    expect(result.status).toBe("inserted");

    const stored = (await db.job.findUnique({ where: { id: result.jobId } })) as Job;
    expect(stored.externalId).toBe(EXTERNAL_ID);
    expect(stored.provider).toBe(PROVIDER);
    expect(stored.fingerprint).toBe(fingerprintForJob(job));
    expect(stored.lastSeenAt).toBeTruthy();
    expect(stored.seenCount).toBe(1);
    expect(stored.sources?.[0]).toMatchObject({ provider: PROVIDER, externalId: EXTERNAL_ID });
    expect(stored.isActive).toBe(true);
  });

  it("updates in place on the next sync (level 1) and bumps the seen counter", async () => {
    const before = (await db.job.findFirst({ where: { externalId: EXTERNAL_ID } })) as Job;

    const result = await upsertNormalizedJob(normalized({ title: "Senior Full Stack Engineer II" }));
    expect(result.status).toBe("updated");
    expect(result.jobId).toBe(before.id);

    const after = (await db.job.findUnique({ where: { id: before.id } })) as Job;
    expect(after.title).toBe("Senior Full Stack Engineer II");
    expect(after.seenCount).toBe(2);
    expect(new Date(after.lastSeenAt!).getTime()).toBeGreaterThanOrEqual(
      new Date(before.lastSeenAt!).getTime()
    );

    const count = await db.job.count({ where: { externalId: EXTERNAL_ID } });
    expect(count).toBe(1);
  });

  it("merges the same opening from another provider instead of duplicating it (level 2)", async () => {
    const canonical = (await db.job.findFirst({ where: { externalId: EXTERNAL_ID } })) as Job;

    const leverJob = normalized({
      provider: "LEVER",
      externalId: "lever-xyz",
      // Same opening: title/location/application domain must match the canonical row.
      title: canonical.title,
      location: canonical.location,
      sourceUrl: "https://jobs.lever.co/ingesttest/lever-xyz",
      applicationUrl: canonical.applicationUrl,
      atsProvider: "LEVER",
    });
    const result = await upsertNormalizedJob(leverJob);

    expect(result.status).toBe("duplicate");
    expect(result.jobId).toBe(canonical.id);
    expect(result.canonicalJobId).toBe(canonical.id);

    // The duplicate is folded into the canonical row: no second job is created
    // and the extra provider is recorded as an alternative source instead.
    const total = await db.job.count({ where: { company: "Ingest Test Inc" } });
    expect(total).toBe(1);

    const refreshed = (await db.job.findUnique({ where: { id: canonical.id } })) as Job;
    const leverRef = refreshed.sources?.find((ref) => ref.provider === "LEVER");
    expect(leverRef).toMatchObject({ externalId: "lever-xyz" });
    expect(refreshed.seenCount).toBeGreaterThanOrEqual(2);
  });

  it("deactivates jobs the provider stopped publishing without deleting them", async () => {
    const stats = emptyStats(PROVIDER);

    const stale = (await db.job.findFirst({ where: { externalId: EXTERNAL_ID } })) as Job;
    const old = new Date(
      Date.now() - (freshnessHours(PROVIDER) + 24) * 60 * 60 * 1000
    ).toISOString();
    await db.job.update({
      where: { id: stale.id },
      data: { lastSeenAt: old, firstSeenAt: old, seenCount: 5 },
    });

    const deactivated = await deactivateStaleJobsForProvider(PROVIDER, stats);
    expect(deactivated).toBeGreaterThanOrEqual(1);

    const after = (await db.job.findUnique({ where: { id: stale.id } })) as Job;
    expect(after).toBeTruthy(); // never deleted
    expect(after.isActive).toBe(false);
    expect(stats.deactivated).toBeGreaterThanOrEqual(1);
  });

  it("never deactivates a job discovered in the current window", async () => {
    const fresh = normalized({ externalId: "test-ingest-fresh", title: "Backend Engineer" });
    const inserted = await upsertNormalizedJob(fresh);

    const stats = emptyStats(PROVIDER);
    await deactivateStaleJobsForProvider(PROVIDER, stats);

    const after = (await db.job.findUnique({ where: { id: inserted.jobId } })) as Job;
    expect(after.isActive).toBe(true);
  });
});
