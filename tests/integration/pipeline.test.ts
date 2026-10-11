import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import db from "@/lib/db";
import { ingestProvider } from "@/jobs/ingestion/ingest";
import { getProviderState, listSyncRuns } from "@/jobs/ingestion/provider-state";
import { freshnessHours } from "@/jobs/ingestion/freshness";
import { runJobExpiration } from "@/workers/job-expiration";
import { runJobSync } from "@/workers/job-sync";
import type { Job, JobSource } from "@/types";

const BOARD_TOKEN = "pipetest";
const COMPANY = "Pipeline Test Co";
const EXTERNAL_ID = "700001";
const SECOND_ID = "700002";

let disabledSources: string[] = [];

function greenhousePayload(ids: string[] = [EXTERNAL_ID]) {
  return {
    jobs: ids.map((id) => ({
      id: Number(id),
      title: `Senior Full Stack Engineer ${id}`,
      updated_at: "2026-10-03T10:00:00-04:00",
      location: { name: "Remote - Europe" },
      departments: [{ name: "Engineering" }],
      content:
        "&lt;p&gt;Build with React, TypeScript, Node.js and PostgreSQL.&lt;/p&gt;&lt;p&gt;Fully remote team.&lt;/p&gt;",
      absolute_url: `https://boards.greenhouse.io/${BOARD_TOKEN}/jobs/${id}`,
      company_name: COMPANY,
    })),
  };
}

function adzunaPayload() {
  return {
    count: 1,
    results: [
      {
        id: "800001",
        title: "Senior Backend Engineer",
        description: "<p>Python, FastAPI and PostgreSQL. Remote friendly.</p>",
        redirect_url: "https://www.adzuna.co.uk/jobs/land/ad/800001",
        created: "2026-10-02T09:00:00Z",
        salary_min: 90000,
        salary_max: 120000,
        salary_is_predicted: "1",
        contract_time: "full_time",
        company: { display_name: "Adzuna Test Co" },
        location: { display_name: "Remote, United Kingdom" },
        category: { label: "IT Jobs" },
      },
    ],
  };
}

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });

async function cleanupJobs() {
  const jobs = (await db.job.findMany({ where: { company: COMPANY } })) as Job[];
  if (jobs.length) await db.job.deleteMany({ where: { id: { in: jobs.map((job) => job.id) } } });
  await db.job.deleteMany({ where: { company: "Adzuna Test Co" } });
}

beforeAll(async () => {
  await cleanupJobs();

  // Isolate the run: only the test board may be synced, otherwise the seeded
  // demo boards would consume the mocked HTTP transport.
  const others = (await db.jobSource.findMany({ where: { provider: "GREENHOUSE", active: true } })) as JobSource[];
  disabledSources = others.filter((source) => source.boardToken !== BOARD_TOKEN).map((source) => source.id);
  for (const id of disabledSources) {
    await db.jobSource.update({ where: { id }, data: { active: false } });
  }

  const existing = await db.jobSource.findFirst({ where: { boardToken: BOARD_TOKEN } });
  if (!existing) {
    await db.jobSource.create({
      data: {
        provider: "GREENHOUSE",
        name: COMPANY,
        companyName: COMPANY,
        boardToken: BOARD_TOKEN,
        type: "GREENHOUSE",
        active: true,
        config: { test: true },
        jobCount: 0,
        jobsImported: 0,
      },
    });
  } else {
    await db.jobSource.update({ where: { id: existing.id }, data: { active: true, lastError: null } });
  }
});

afterAll(async () => {
  await cleanupJobs();
  await db.jobSource.deleteMany({ where: { boardToken: BOARD_TOKEN } });
  for (const id of disabledSources) {
    await db.jobSource.update({ where: { id }, data: { active: true } });
  }
  await db.providerSyncRun.deleteMany({ where: { provider: "GREENHOUSE" } });
  await db.providerState.deleteMany({ where: { provider: "GREENHOUSE" } });
});

describe("provider ingestion pipeline", () => {
  it("ingests a mocked Greenhouse board end to end and records health", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(greenhousePayload()));

    const stats = await ingestProvider("GREENHOUSE", {
      triggeredBy: "test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(stats.status).toBe("SUCCESS");
    expect(stats.sourcesProcessed).toBe(1);
    expect(stats.fetched).toBe(1);
    expect(stats.inserted + stats.updated).toBe(1);

    const job = (await db.job.findFirst({ where: { company: COMPANY } })) as Job;
    expect(job.externalId).toBe(EXTERNAL_ID);
    expect(job.provider).toBe("GREENHOUSE");
    expect(job.fingerprint).toBeTruthy();
    expect(job.isActive).toBe(true);
    expect(job.workplaceType).toBe("REMOTE");
    expect(job.skills).toEqual(expect.arrayContaining(["React", "TypeScript", "Node.js", "PostgreSQL"]));
    expect(job.description).not.toContain("&lt;");
    // provider payload stays server-side, keyed to the configured board
    expect(job.rawData).toMatchObject({ boardToken: BOARD_TOKEN });

    const state = await getProviderState("GREENHOUSE");
    expect(state.lastSyncAt).toBeTruthy();
    expect(state.lastSuccessAt).toBeTruthy();
    expect(state.lastError).toBeFalsy();
    expect(state.status).toBe("HEALTHY");

    const runs = await listSyncRuns("GREENHOUSE", 5);
    expect(runs.some((run) => run.status === "SUCCESS")).toBe(true);

    const source = (await db.jobSource.findFirst({ where: { boardToken: BOARD_TOKEN } })) as JobSource;
    expect(source.lastSyncAt).toBeTruthy();
    expect(source.lastError ?? null).toBeNull();

    // the provider lock was released: a second run is not skipped
    const second = await ingestProvider("GREENHOUSE", {
      triggeredBy: "test",
      skipExpiry: true,
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse(greenhousePayload())) as unknown as typeof fetch,
    });
    expect(second.status).toBe("SUCCESS");
    expect(second.errors.some((error) => error.message.includes("locked"))).toBe(false);

    expect(await db.job.count({ where: { company: COMPANY } })).toBe(1); // level 1 upsert
  });

  it("deactivates jobs the board stopped advertising on the next sync", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(greenhousePayload([EXTERNAL_ID, SECOND_ID])));

    await ingestProvider("GREENHOUSE", {
      triggeredBy: "test",
      skipExpiry: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(await db.job.count({ where: { company: COMPANY, isActive: true } })).toBe(2);

    // Older than the provider freshness window so the first-seen grace period
    // (which gives brand new jobs one full window) no longer applies.
    const staleSince = new Date(
      Date.now() - (freshnessHours("GREENHOUSE") + 24) * 60 * 60 * 1000
    ).toISOString();
    const second = (await db.job.findFirst({ where: { externalId: SECOND_ID } })) as Job;
    await db.job.update({
      where: { id: second.id },
      data: { firstSeenAt: staleSince, lastSeenAt: staleSince, seenCount: 5 },
    });

    // Next sync only returns the first job -> the missing one is deactivated, not deleted.
    await ingestProvider("GREENHOUSE", {
      triggeredBy: "test",
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse(greenhousePayload())) as unknown as typeof fetch,
    });

    const closed = (await db.job.findUnique({ where: { id: second.id } })) as Job;
    expect(closed).toBeTruthy();
    expect(closed.isActive).toBe(false);

    // Jobs seen in this run stay active.
    const kept = (await db.job.findFirst({ where: { externalId: EXTERNAL_ID } })) as Job;
    expect(kept.isActive).toBe(true);
  });

  it("records provider failures (and the source-level error) without crashing", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("socket hang up"));

    const stats = await ingestProvider("GREENHOUSE", {
      triggeredBy: "test-failure",
      fetchImpl: failing as unknown as typeof fetch,
    });

    expect(stats.status).toBe("FAILED");
    expect(stats.sourcesFailed).toBe(1);
    expect(stats.errors[0]?.message).toContain("socket hang up");

    const state = await getProviderState("GREENHOUSE");
    expect(state.lastError).toBeTruthy();
    expect(["WARNING", "UNHEALTHY"]).toContain(state.status);

    const source = (await db.jobSource.findFirst({ where: { boardToken: BOARD_TOKEN } })) as JobSource;
    expect(source.lastError).toContain("socket hang up");

    // a later successful sync clears the error state again
    await ingestProvider("GREENHOUSE", {
      triggeredBy: "test-recovery",
      skipExpiry: true,
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse(greenhousePayload())) as unknown as typeof fetch,
    });
    const recovered = (await db.jobSource.findFirst({ where: { boardToken: BOARD_TOKEN } })) as JobSource;
    expect(recovered.lastError).toBeNull();
  });

  it("ingests the Adzuna search provider with its API credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(adzunaPayload()));

    const stats = await ingestProvider("ADZUNA", {
      triggeredBy: "test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(stats.status).toBe("SUCCESS");
    expect(stats.inserted + stats.updated).toBeGreaterThanOrEqual(1);

    const calledUrl = String(fetchImpl.mock.calls[0][0]);
    expect(calledUrl).toContain("app_id=test-app-id");
    expect(calledUrl).toContain("app_key=test-app-key");

    const job = (await db.job.findFirst({ where: { provider: "ADZUNA" } })) as Job;
    expect(job.company).toBe("Adzuna Test Co");
    expect(job.salaryIsPredicted).toBe(true);
    expect(job.applicationType).toBe("MANUAL_REQUIRED"); // aggregator: never auto-submit
    expect(job.atsProvider).toBe("MANUAL");
  });

  it("runs the sync worker and the expiry sweep with an injected fetch", async () => {
    const summary = await runJobSync({
      providers: ["GREENHOUSE"],
      triggeredBy: "test-worker",
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse(greenhousePayload())) as unknown as typeof fetch,
    });

    expect(summary.providers).toHaveLength(1);
    expect(summary.totals.fetched).toBeGreaterThanOrEqual(1);
    expect(summary.startedAt).toBeTruthy();
    expect(typeof summary.durationMs).toBe("number");

    const expiry = await runJobExpiration();
    expect(expiry.evaluated).toBeGreaterThan(0);
    expect(expiry.deactivated).toBeGreaterThanOrEqual(0);
    expect(await db.job.count({ where: { company: COMPANY } })).toBeGreaterThanOrEqual(1);
  });
});
