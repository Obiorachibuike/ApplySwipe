import type { ProviderName } from "@/jobs/providers/types";

/**
 * Provider freshness + scheduling configuration.
 *
 * A job is considered fresh while its provider keeps returning it during a sync
 * (`lastSeenAt` is refreshed). Once a job has not been seen for the provider's
 * freshness window it is deactivated (never deleted) so application history and
 * analytics stay intact.
 *
 * Every value can be overridden with environment variables:
 *   JOB_FRESHNESS_<PROVIDER>_HOURS   e.g. JOB_FRESHNESS_ADZUNA_HOURS=24
 *   JOB_SYNC_INTERVAL_<PROVIDER>_MIN e.g. JOB_SYNC_INTERVAL_GREENHOUSE_MIN=60
 */

export const DEFAULT_FRESHNESS_HOURS: Record<string, number> = {
  ADZUNA: 48,
  GREENHOUSE: 72,
  LEVER: 72,
  LEGACY: 720,
};

export const DEFAULT_SYNC_INTERVAL_MINUTES: Record<string, number> = {
  ADZUNA: 120,
  GREENHOUSE: 360,
  LEVER: 360,
  LEGACY: 1440,
};

export const DEFAULT_FEED_HORIZON_DAYS = Number(process.env.JOB_FEED_HORIZON_DAYS || 45);

function envNumber(key: string): number | undefined {
  const raw = process.env[key];
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function freshnessHours(provider: string): number {
  const key = `JOB_FRESHNESS_${String(provider).toUpperCase()}_HOURS`;
  return (
    envNumber(key) ??
    DEFAULT_FRESHNESS_HOURS[String(provider).toUpperCase()] ??
    DEFAULT_FRESHNESS_HOURS.LEGACY
  );
}

export function syncIntervalMinutes(provider: string): number {
  const key = `JOB_SYNC_INTERVAL_${String(provider).toUpperCase()}_MIN`;
  return (
    envNumber(key) ??
    DEFAULT_SYNC_INTERVAL_MINUTES[String(provider).toUpperCase()] ??
    DEFAULT_SYNC_INTERVAL_MINUTES.LEGACY
  );
}

export interface StaleCheckInput {
  provider?: string | null;
  lastSeenAt?: string | Date | null;
  postedAt?: string | Date | null;
  expiresAt?: string | Date | null;
  isActive?: boolean;
}

function toTime(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/** Reasons a job must leave the feed. */
export type StaleReason = "EXPIRED" | "NOT_SEEN" | null;

export function staleReason(job: StaleCheckInput, now = new Date()): StaleReason {
  const expiresAt = toTime(job.expiresAt);
  if (expiresAt !== null && expiresAt < now.getTime()) return "EXPIRED";

  const reference = toTime(job.lastSeenAt) ?? toTime(job.postedAt);
  if (reference === null) return null;

  const windowHours = freshnessHours(job.provider || "LEGACY");
  const ageHours = (now.getTime() - reference) / (1000 * 60 * 60);
  if (ageHours > windowHours) return "NOT_SEEN";

  return null;
}

export function isStale(job: StaleCheckInput, now = new Date()): boolean {
  return staleReason(job, now) !== null;
}

/** Jobs older than this are hidden from the feed even if not explicitly expired. */
export function withinFeedHorizon(
  postedAt: string | Date | null | undefined,
  horizonDays = DEFAULT_FEED_HORIZON_DAYS,
  now = new Date()
): boolean {
  const time = toTime(postedAt);
  if (time === null) return true;
  return now.getTime() - time <= horizonDays * 24 * 60 * 60 * 1000;
}

/** Provider level freshness settings exposed to the admin UI. */
export function providerFreshnessSettings(providers: string[] = ["ADZUNA", "GREENHOUSE", "LEVER"]) {
  return providers.map((provider) => ({
    provider: provider as ProviderName | string,
    freshnessHours: freshnessHours(provider),
    syncIntervalMinutes: syncIntervalMinutes(provider),
  }));
}

/** True when the provider is due for its next scheduled sync. */
export function isProviderDue(
  provider: string,
  lastSyncAt: string | Date | null | undefined,
  now = new Date()
): boolean {
  const last = toTime(lastSyncAt);
  if (last === null) return true;
  const intervalMs = syncIntervalMinutes(provider) * 60 * 1000;
  return now.getTime() - last >= intervalMs;
}
