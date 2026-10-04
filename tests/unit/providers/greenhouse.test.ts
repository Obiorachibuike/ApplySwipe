import { describe, it, expect, vi } from "vitest";
import { GreenhouseAdapter } from "@/jobs/providers/greenhouse";
import { ProviderError } from "@/jobs/providers/http";

const boardPayload = {
  jobs: [
    {
      id: 4091222,
      internal_job_id: 998877,
      title: "Senior Full Stack Engineer",
      updated_at: "2026-09-30T12:00:00-04:00",
      requisition_id: "ENG-42",
      location: { name: "Remote - US" },
      offices: [{ id: 1, name: "Remote" }],
      departments: [{ id: 2, name: "Engineering" }],
      metadata: [
        { name: "Employment Type", value: "Full-time" },
        { name: "Salary Range", value: "$165,000 - $215,000" },
      ],
      content:
        "&lt;div&gt;&lt;p&gt;Build real-time collaboration with React, TypeScript and Node.js.&lt;/p&gt;&lt;p&gt;We use PostgreSQL and AWS.&lt;/p&gt;&lt;/div&gt;",
      absolute_url: "https://boards.greenhouse.io/linear/jobs/4091222",
      company_name: "Linear",
    },
    {
      id: 4091223,
      title: "Junior Designer",
      location: { name: "San Francisco, CA" },
      departments: [],
      content: "<p>Design systems work with Figma.</p>",
      absolute_url: "https://boards.greenhouse.io/linear/jobs/4091223",
    },
    {
      // malformed row: no id, must be skipped instead of crashing the sync
      title: "Ghost job",
    },
  ],
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const source = {
  provider: "GREENHOUSE" as const,
  companyName: "Linear",
  boardToken: "linear",
};

describe("GreenhouseAdapter", () => {
  const adapter = new GreenhouseAdapter();

  it("normalizes a Greenhouse board into canonical jobs", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(boardPayload));

    const jobs = await adapter.search(
      {},
      { source, fetchImpl: fetchImpl as unknown as typeof fetch, retries: 0 }
    );

    expect(jobs).toHaveLength(2); // malformed row skipped

    const [first] = jobs;
    expect(first.externalId).toBe("4091222");
    expect(first.provider).toBe("GREENHOUSE");
    expect(first.companyName).toBe("Linear");
    expect(first.location).toBe("Remote - US");
    expect(first.workplaceType).toBe("REMOTE");
    expect(first.employmentType).toBe("Full-time");
    expect(first.salaryMin).toBe(165000);
    expect(first.salaryMax).toBe(215000);
    expect(first.salaryCurrency).toBe("USD");
    expect(first.sourceUrl).toBe("https://boards.greenhouse.io/linear/jobs/4091222");
    expect(first.applicationUrl).toBe(first.sourceUrl);
    expect(first.skills).toEqual(expect.arrayContaining(["React", "TypeScript", "Node.js", "PostgreSQL", "AWS"]));
    // content was HTML-entity encoded + HTML - both are cleaned up
    expect(first.description).not.toContain("&lt;");
    expect(first.description).not.toContain("<p>");
    expect(first.rawData).toMatchObject({ greenhouseId: 4091222, boardToken: "linear" });
  });

  it("uses the configured company name when the board omits it", async () => {
    const payload = { jobs: [{ ...boardPayload.jobs[1] }] };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(payload));

    const jobs = await adapter.search(
      {},
      { source, fetchImpl: fetchImpl as unknown as typeof fetch, retries: 0 }
    );

    expect(jobs[0].companyName).toBe("Linear");
  });

  it("requires a board token (no hard-coded companies)", async () => {
    await expect(adapter.search({}, {})).rejects.toMatchObject({ kind: "CONFIG" });
  });

  it("applies query/location filters client-side", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(boardPayload));

    const jobs = await adapter.search(
      { query: "designer" },
      { source, fetchImpl: fetchImpl as unknown as typeof fetch, retries: 0 }
    );

    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("Junior Designer");
  });

  it("loads a single job by id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(boardPayload.jobs[0]));

    const job = await adapter.getJob("4091222", {
      source,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retries: 0,
    });

    expect(job?.externalId).toBe("4091222");
    expect(String(fetchImpl.mock.calls[0][0])).toContain("/v1/boards/linear/jobs/4091222");
  });

  it("returns null for a 404 job and surfaces other provider errors", async () => {
    const notFound = vi.fn().mockResolvedValue(jsonResponse({ error: "not found" }, 404));
    expect(
      await adapter.getJob("nope", { source, fetchImpl: notFound as unknown as typeof fetch, retries: 0 })
    ).toBeNull();

    const serverError = vi.fn().mockResolvedValue(jsonResponse({ error: "boom" }, 500));
    await expect(
      adapter.getJob("4091222", {
        source,
        fetchImpl: serverError as unknown as typeof fetch,
        retries: 0,
      })
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("rejects malformed board payloads", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ unexpected: true }));

    await expect(
      adapter.search({}, { source, fetchImpl: fetchImpl as unknown as typeof fetch, retries: 0 })
    ).rejects.toMatchObject({ kind: "MALFORMED" });
  });
});
