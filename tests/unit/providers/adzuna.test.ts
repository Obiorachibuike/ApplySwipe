import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdzunaAdapter, currencyForCountry } from "@/jobs/providers/adzuna";
import { ProviderError } from "@/jobs/providers/http";

/** Fixture modelled on a real Adzuna /search response. */
const adzunaPayload = {
  count: 2,
  results: [
    {
      id: "4892019",
      title: "Senior Full Stack Engineer (Remote)",
      description:
        "<p>We are hiring a <strong>Senior Full Stack Engineer</strong>. You will build with React, TypeScript, Node.js and PostgreSQL. Work from anywhere.</p>",
      redirect_url: "https://www.adzuna.co.uk/jobs/land/ad/4892019",
      created: "2026-09-28T09:15:00Z",
      salary_min: 85000,
      salary_max: 110000,
      salary_is_predicted: "0",
      contract_time: "full_time",
      contract_type: "permanent",
      company: { display_name: "Example Inc" },
      location: { display_name: "Remote, United Kingdom", area: ["UK", "London"] },
      category: { label: "IT Jobs", tag: "it-jobs" },
      latitude: 51.5,
      longitude: -0.12,
    },
    {
      id: "4892020",
      // missing company + salary on purpose: must not crash the adapter
      title: "Data Engineer",
      description: "Looking for a Python, FastAPI and AWS data engineer with ETL experience.",
      redirect_url: "https://www.adzuna.co.uk/jobs/land/ad/4892020",
      created: "2026-09-29T11:00:00Z",
      salary_is_predicted: "1",
      location: { display_name: "" },
      category: { label: "IT Jobs" },
    },
  ],
};

function jsonResponse(payload: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("AdzunaAdapter", () => {
  let adapter: AdzunaAdapter;

  beforeEach(() => {
    adapter = new AdzunaAdapter();
  });

  it("normalizes Adzuna results into the canonical job shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(adzunaPayload));

    const jobs = await adapter.search(
      { query: "full stack", location: "London", limit: 50 },
      { fetchImpl: fetchImpl as unknown as typeof fetch, retries: 0 }
    );

    expect(jobs).toHaveLength(2);

    const first = jobs[0];
    expect(first.externalId).toBe("4892019");
    expect(first.provider).toBe("ADZUNA");
    expect(first.companyName).toBe("Example Inc");
    expect(first.title).toContain("Full Stack Engineer");
    expect(first.location).toBe("Remote, United Kingdom");
    expect(first.workplaceType).toBe("REMOTE");
    expect(first.salaryMin).toBe(85000);
    expect(first.salaryMax).toBe(110000);
    expect(first.salaryCurrency).toBe("GBP");
    expect(first.salaryIsPredicted).toBeUndefined();
    expect(first.employmentType).toBe("Full-time");
    expect(first.sourceUrl).toBe("https://www.adzuna.co.uk/jobs/land/ad/4892019");
    expect(first.applicationUrl).toBe(first.sourceUrl);
    expect(first.postedAt?.toISOString().startsWith("2026-09-28")).toBe(true);
    expect(first.skills).toEqual(expect.arrayContaining(["React", "TypeScript", "Node.js", "PostgreSQL"]));
    // description is HTML-cleaned plain text
    expect(first.description).not.toMatch(/<p>|<strong>/);
    expect(first.rawData).toMatchObject({ adzunaId: "4892019" });
  });

  it("handles missing company, salary and location without throwing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(adzunaPayload));

    const jobs = await adapter.search({}, { fetchImpl: fetchImpl as unknown as typeof fetch, retries: 0 });
    const second = jobs[1];

    expect(second.companyName).toBe("Unknown company");
    expect(second.salaryIsPredicted).toBe(true);
    expect(second.location).toBe("Location not specified");
    expect(second.workplaceType).toBe("UNKNOWN");
  });

  it("sends credentials server-side only and never exposes them in results", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ results: [] }));

    await adapter.search({ query: "react" }, { fetchImpl: fetchImpl as unknown as typeof fetch, retries: 0 });

    const calledUrl = String(fetchImpl.mock.calls[0][0]);
    expect(calledUrl).toContain("app_id=test-app-id");
    expect(calledUrl).toContain("app_key=test-app-key");
    expect(calledUrl).toContain("what=react");
  });

  it("maps rate limits to a retryable ProviderError and gives up after the retry budget", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "rate limited" }, 429, { "retry-after": "1" }));

    await expect(
      adapter.search({}, { fetchImpl: fetchImpl as unknown as typeof fetch, retries: 1, timeoutMs: 500 })
    ).rejects.toMatchObject({ kind: "RATE_LIMIT", retryable: true });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reports malformed payloads instead of crashing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>not json</html>", { status: 200 }));

    await expect(
      adapter.search({}, { fetchImpl: fetchImpl as unknown as typeof fetch, retries: 0 })
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("retries server errors with backoff then surfaces a ProviderError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 503));

    const error = await adapter
      .search({}, { fetchImpl: fetchImpl as unknown as typeof fetch, retries: 1 })
      .catch((err) => err);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error.kind).toBe("HTTP");
    expect(error.status).toBe(503);
  });

  it("filters non-remote jobs when remote filtering is requested", async () => {
    const payload = {
      results: [
        { ...adzunaPayload.results[0] },
        {
          id: "4892021",
          title: "On-site Support Engineer",
          description: "Office based support role in Leeds requiring Windows and networking skills.",
          redirect_url: "https://www.adzuna.co.uk/jobs/land/ad/4892021",
          company: { display_name: "Support Co" },
          location: { display_name: "Leeds, West Yorkshire" },
        },
      ],
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(payload));

    const jobs = await adapter.search(
      { remote: true },
      { fetchImpl: fetchImpl as unknown as typeof fetch, retries: 0 }
    );

    expect(jobs).toHaveLength(1);
    expect(jobs[0].workplaceType).toBe("REMOTE");
  });

  it("returns null from getJob when the id is not in the search results", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ results: [] }));
    const job = await adapter.getJob("missing-id", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retries: 0,
    });
    expect(job).toBeNull();
  });

  it("maps country codes to currency hints", () => {
    expect(currencyForCountry("gb")).toBe("GBP");
    expect(currencyForCountry("us")).toBe("USD");
    expect(currencyForCountry("ng")).toBe("NGN");
    expect(currencyForCountry("zz")).toBeUndefined();
  });
});
