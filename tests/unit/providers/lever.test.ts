import { describe, it, expect, vi } from "vitest";
import { LeverAdapter } from "@/jobs/providers/lever";
import { ProviderError } from "@/jobs/providers/http";

const PRIMARY_ID = "8f2a1c3e-1234-4a5b-9c8d-abcdef123456";

const postingsPayload = [
  {
    id: PRIMARY_ID,
    text: "Staff Backend Engineer",
    hostedUrl: "https://jobs.lever.co/mistral/8f2a1c3e-1234-4a5b-9c8d-abcdef123456",
    applyUrl: "https://jobs.lever.co/mistral/8f2a1c3e-1234-4a5b-9c8d-abcdef123456/apply",
    createdAt: 1759248000000, // epoch millis
    categories: {
      location: "Paris, France (Remote)",
      team: "Engineering",
      commitment: "Full-time",
    },
    descriptionPlain: "Work on inference infrastructure with Python, PyTorch and Kubernetes.",
    description:
      "<div><p>Work on inference infrastructure with Python, PyTorch and Kubernetes.</p></div>",
    salaryRange: { min: 90000, max: 130000, currency: "EUR", interval: "year" },
  },
  {
    // missing salary and categories: must survive normalization
    id: "11111111-2222-3333-4444-555555555555",
    text: "Developer Advocate",
    hostedUrl: "https://jobs.lever.co/mistral/11111111-2222-3333-4444-555555555555",
    createdAt: 1759334400000,
    descriptionPlain: "Talk about LLMs, write docs and build TypeScript demos.",
  },
  {
    // invalid row: no id
    text: "Ghost posting",
  },
];

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

const source = { provider: "LEVER" as const, companyName: "Mistral", boardToken: "mistral" };

describe("LeverAdapter", () => {
  const adapter = new LeverAdapter();

  it("normalizes a Lever board into canonical jobs", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(postingsPayload));

    const jobs = await adapter.search(
      {},
      { source, fetchImpl: fetchImpl as unknown as typeof fetch, retries: 0 }
    );

    expect(jobs).toHaveLength(2);

    const [first] = jobs;
    expect(first.externalId).toBe(PRIMARY_ID);
    expect(first.provider).toBe("LEVER");
    expect(first.companyName).toBe("Mistral");
    expect(first.title).toBe("Staff Backend Engineer");
    expect(first.location).toBe("Paris, France (Remote)");
    expect(first.workplaceType).toBe("REMOTE");
    expect(first.employmentType).toBe("Full-time");
    expect(first.salaryMin).toBe(90000);
    expect(first.salaryMax).toBe(130000);
    expect(first.salaryCurrency).toBe("EUR");
    expect(first.applicationUrl).toBe(
      "https://jobs.lever.co/mistral/8f2a1c3e-1234-4a5b-9c8d-abcdef123456/apply"
    );
    expect(first.skills).toEqual(expect.arrayContaining(["Python", "PyTorch", "Kubernetes"]));
    expect(first.postedAt?.toISOString().startsWith("2025-09-30")).toBe(true);
    expect(first.rawData).toMatchObject({ leverId: postingsPayload[0].id, boardToken: "mistral" });
  });

  it("keeps description-only postings usable", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(postingsPayload));

    const jobs = await adapter.search(
      {},
      { source, fetchImpl: fetchImpl as unknown as typeof fetch, retries: 0 }
    );
    const second = jobs[1];

    expect(second.salaryMin).toBeUndefined();
    expect(second.location).toBe("Location not specified");
    // Postings without a commitment are stored as the platform default (Full-time)
    // so employment-type filters keep working; the raw commitment stays in rawData.
    expect(second.employmentType).toBe("Full-time");
    expect((second.rawData as Record<string, unknown>).commitment).toBeUndefined();
  });

  it("requires a company slug", async () => {
    await expect(adapter.search({}, {})).rejects.toMatchObject({ kind: "CONFIG" });
  });

  it("retries 5xx responses then raises a ProviderError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "boom" }, 500));

    const error = await adapter
      .search({}, { source, fetchImpl: fetchImpl as unknown as typeof fetch, retries: 1 })
      .catch((err) => err);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error.status).toBe(500);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("loads a single posting by id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(postingsPayload[0]));

    const job = await adapter.getJob(PRIMARY_ID, {
      source,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retries: 0,
    });

    expect(job?.title).toBe("Staff Backend Engineer");
    expect(String(fetchImpl.mock.calls[0][0])).toContain(`/v0/postings/mistral/${PRIMARY_ID}`);
  });
});
