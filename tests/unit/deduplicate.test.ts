import { describe, it, expect } from "vitest";
import {
  AGGREGATOR_DOMAINS,
  applicationDomain,
  buildExternalKey,
  computeFingerprint,
  findDuplicates,
  fingerprintForJob,
  mergeSourceRef,
  normalizeTitleForFingerprint,
} from "@/jobs/ingestion/deduplicate";
import { buildNormalizedJob } from "@/jobs/ingestion/normalize";
import type { NormalizedJob } from "@/jobs/providers/types";

function normalized(overrides: Partial<Parameters<typeof buildNormalizedJob>[0]> = {}): NormalizedJob {
  return buildNormalizedJob({
    provider: "GREENHOUSE",
    externalId: "1",
    title: "Senior Full Stack Engineer",
    companyName: "Linear",
    description: "Build real-time collaboration software with React and TypeScript.",
    location: "Remote - US",
    sourceUrl: "https://boards.greenhouse.io/linear/jobs/1",
    applicationUrl: "https://linear.app/careers/1",
    ...overrides,
  });
}

describe("level 1 identity (provider + external id)", () => {
  it("builds a stable external key", () => {
    expect(buildExternalKey("greenhouse", "42")).toBe("GREENHOUSE:42");
    expect(buildExternalKey("LEVER", "abc")).toBe("LEVER:abc");
  });

  it("matches the same provider + external id", () => {
    const job = normalized({ externalId: "4091" });
    const lookup = findDuplicates(job, [
      { id: "db-1", provider: "GREENHOUSE", externalId: "4091", fingerprint: "other" },
    ]);

    expect(lookup.externalMatch?.id).toBe("db-1");
  });

  it("does not match a different provider with the same external id", () => {
    const job = normalized({ provider: "LEVER", externalId: "4091" });
    const lookup = findDuplicates(job, [
      { id: "db-1", provider: "GREENHOUSE", externalId: "4091" },
    ]);

    expect(lookup.externalMatch).toBeUndefined();
  });
});

describe("level 2 identity (fingerprint)", () => {
  it("normalizes titles before hashing", () => {
    expect(normalizeTitleForFingerprint("Senior Full Stack Engineer")).toBe(
      normalizeTitleForFingerprint("senior full-stack engineer (Remote)")
    );
    expect(normalizeTitleForFingerprint("Staff Engineer II")).not.toBe(
      normalizeTitleForFingerprint("Staff Engineer")
    );
  });

  it("ignores aggregator hosts in the application domain", () => {
    expect(applicationDomain("https://www.adzuna.co.uk/jobs/land/ad/4892019")).toBe("");
    expect(applicationDomain("https://www.linkedin.com/jobs/view/123")).toBe("");
    expect(applicationDomain("https://jobs.lever.co/mistral/abc")).toBe("");
    expect(applicationDomain("https://careers.linear.app/jobs/1")).toBe("careers.linear.app");
    expect(AGGREGATOR_DOMAINS.length).toBeGreaterThan(3);
  });

  it("produces the same fingerprint regardless of case, punctuation and tracking params", () => {
    const a = computeFingerprint({
      companyName: "Linear",
      title: "Senior Full Stack Engineer",
      location: "Remote - US",
      applicationUrl: "https://linear.app/careers/1?utm_source=twitter",
    });
    const b = computeFingerprint({
      companyName: "linear, inc.",
      title: "senior full stack engineer",
      location: "remote us",
      applicationUrl: "https://www.linear.app/careers/1",
    });

    expect(a).toBe(b);
    expect(a).toHaveLength(40);
  });

  it("matches the same opening advertised by a different provider", () => {
    const greenhouse = normalized({ provider: "GREENHOUSE", externalId: "4091" });
    const lever = normalized({
      provider: "LEVER",
      externalId: "xyz",
      sourceUrl: "https://jobs.lever.co/linear/xyz",
      applicationUrl: "https://linear.app/careers/1",
    });

    expect(fingerprintForJob(lever)).toBe(fingerprintForJob(greenhouse));

    const lookup = findDuplicates(lever, [
      {
        id: "db-1",
        provider: "GREENHOUSE",
        externalId: "4091",
        fingerprint: fingerprintForJob(greenhouse),
        isActive: true,
      },
    ]);

    expect(lookup.externalMatch).toBeUndefined();
    expect(lookup.fingerprintMatch?.id).toBe("db-1");
  });

  it("never merges into an inactive or already-merged record", () => {
    const job = normalized();
    const fingerprint = fingerprintForJob(job);

    expect(
      findDuplicates(job, [{ id: "a", provider: "ADZUNA", externalId: "9", fingerprint, isActive: false }])
        .fingerprintMatch
    ).toBeUndefined();

    expect(
      findDuplicates(job, [
        { id: "b", provider: "ADZUNA", externalId: "9", fingerprint, canonicalJobId: "canonical" },
      ]).fingerprintMatch
    ).toBeUndefined();
  });
});

describe("source references", () => {
  const ref = {
    provider: "GREENHOUSE",
    externalId: "4091",
    sourceUrl: "https://boards.greenhouse.io/linear/jobs/4091",
    applicationUrl: "https://linear.app/careers/1",
    firstSeenAt: "2026-09-01T00:00:00.000Z",
    lastSeenAt: "2026-09-01T00:00:00.000Z",
  };

  it("adds a new provider reference", () => {
    const refs = mergeSourceRef([], ref);
    expect(refs).toHaveLength(1);
    expect(refs[0].provider).toBe("GREENHOUSE");
  });

  it("updates an existing reference without duplicating it", () => {
    const refs = mergeSourceRef([ref], {
      ...ref,
      lastSeenAt: "2026-10-01T00:00:00.000Z",
      applicationUrl: "https://linear.app/careers/updated",
    });

    expect(refs).toHaveLength(1);
    expect(refs[0].lastSeenAt).toBe("2026-10-01T00:00:00.000Z");
    expect(refs[0].applicationUrl).toBe("https://linear.app/careers/updated");
    expect(refs[0].firstSeenAt).toBe("2026-09-01T00:00:00.000Z");
  });

  it("caps stored references at 10 to keep records small", () => {
    let refs = [] as ReturnType<typeof mergeSourceRef>;
    for (let i = 0; i < 14; i += 1) {
      refs = mergeSourceRef(refs, { ...ref, externalId: String(i) });
    }
    expect(refs).toHaveLength(10);
  });
});
