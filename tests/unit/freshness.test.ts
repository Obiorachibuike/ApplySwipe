import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_FRESHNESS_HOURS,
  DEFAULT_SYNC_INTERVAL_MINUTES,
  freshnessHours,
  isProviderDue,
  isStale,
  providerFreshnessSettings,
  staleReason,
  syncIntervalMinutes,
  withinFeedHorizon,
} from "@/jobs/ingestion/freshness";

const NOW = new Date("2026-10-04T12:00:00.000Z");

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

afterEach(() => {
  delete process.env.JOB_FRESHNESS_ADZUNA_HOURS;
  delete process.env.JOB_SYNC_INTERVAL_LEVER_MIN;
});

describe("provider cadence defaults", () => {
  it("uses the documented per-provider windows", () => {
    expect(DEFAULT_FRESHNESS_HOURS.ADZUNA).toBe(48);
    expect(DEFAULT_FRESHNESS_HOURS.GREENHOUSE).toBe(72);
    expect(DEFAULT_FRESHNESS_HOURS.LEVER).toBe(72);

    expect(DEFAULT_SYNC_INTERVAL_MINUTES.ADZUNA).toBe(120);
    expect(DEFAULT_SYNC_INTERVAL_MINUTES.GREENHOUSE).toBe(360);
    expect(DEFAULT_SYNC_INTERVAL_MINUTES.LEVER).toBe(360);
  });

  it("is configurable per provider through env vars", () => {
    process.env.JOB_FRESHNESS_ADZUNA_HOURS = "12";
    process.env.JOB_SYNC_INTERVAL_LEVER_MIN = "30";

    expect(freshnessHours("ADZUNA")).toBe(12);
    expect(syncIntervalMinutes("lever")).toBe(30);
    // untouched providers keep their defaults
    expect(freshnessHours("GREENHOUSE")).toBe(72);
    expect(syncIntervalMinutes("GREENHOUSE")).toBe(360);

    const settings = providerFreshnessSettings();
    expect(settings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "ADZUNA", freshnessHours: 12 }),
        expect.objectContaining({ provider: "LEVER", syncIntervalMinutes: 30 }),
      ])
    );
  });

  it("falls back to the legacy window for unknown providers", () => {
    expect(freshnessHours("MYSTERY_FEED")).toBe(DEFAULT_FRESHNESS_HOURS.LEGACY);
    expect(syncIntervalMinutes("MYSTERY_FEED")).toBe(DEFAULT_SYNC_INTERVAL_MINUTES.LEGACY);
  });
});

describe("stale detection", () => {
  it("keeps a job seen inside its provider window", () => {
    expect(staleReason({ provider: "ADZUNA", lastSeenAt: hoursAgo(10) }, NOW)).toBeNull();
    expect(staleReason({ provider: "GREENHOUSE", lastSeenAt: hoursAgo(60) }, NOW)).toBeNull();
  });

  it("marks a job NOT_SEEN once its provider window has passed", () => {
    expect(staleReason({ provider: "ADZUNA", lastSeenAt: hoursAgo(72) }, NOW)).toBe("NOT_SEEN");
    expect(staleReason({ provider: "GREENHOUSE", lastSeenAt: hoursAgo(73) }, NOW)).toBe("NOT_SEEN");
    expect(isStale({ provider: "LEVER", lastSeenAt: hoursAgo(100) }, NOW)).toBe(true);
  });

  it("prefers the explicit expiry date over the refresh window", () => {
    expect(
      staleReason({ provider: "GREENHOUSE", lastSeenAt: hoursAgo(1), expiresAt: hoursAgo(1) }, NOW)
    ).toBe("EXPIRED");
    // A future expiry date does not rescue a job the provider stopped showing:
    // NOT_SEEN still applies so the feed stays fresh.
    expect(
      staleReason({ provider: "GREENHOUSE", lastSeenAt: hoursAgo(200), expiresAt: hoursAgo(-24) }, NOW)
    ).toBe("NOT_SEEN");
  });

  it("falls back to postedAt when the job was never re-seen", () => {
    expect(staleReason({ provider: "ADZUNA", postedAt: hoursAgo(50) }, NOW)).toBe("NOT_SEEN");
    // no timestamps at all -> cannot decide, never delete data on a guess
    expect(staleReason({ provider: "ADZUNA" }, NOW)).toBeNull();
  });
});

describe("feed horizon and scheduler due checks", () => {
  it("hides very old postings from the feed but keeps them in the database", () => {
    expect(withinFeedHorizon(hoursAgo(24 * 10).toString(), 45, NOW)).toBe(true);
    expect(withinFeedHorizon(hoursAgo(24 * 90).toString(), 45, NOW)).toBe(false);
    expect(withinFeedHorizon(null, 45, NOW)).toBe(true);
  });

  it("reports a provider due only after its sync interval", () => {
    expect(isProviderDue("ADZUNA", hoursAgo(1), NOW)).toBe(false);
    expect(isProviderDue("ADZUNA", hoursAgo(3), NOW)).toBe(true);
    expect(isProviderDue("GREENHOUSE", hoursAgo(5), NOW)).toBe(false);
    expect(isProviderDue("GREENHOUSE", hoursAgo(7), NOW)).toBe(true);
    expect(isProviderDue("GREENHOUSE", null, NOW)).toBe(true);
  });
});
