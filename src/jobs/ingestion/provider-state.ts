import crypto from "crypto";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { DEFAULT_FRESHNESS_HOURS, freshnessHours, syncIntervalMinutes } from "./freshness";
import { getProviderInfo, isProviderConfigured } from "@/jobs/providers";
import type { ProviderState, ProviderSyncRun } from "@/types";

const log = createLogger("jobs:state");

const DEFAULT_LOCK_TTL_MS = Number(process.env.JOB_SYNC_LOCK_TTL_MS || 15 * 60 * 1000);
const WARNING_AFTER_FAILURES = 1;
const UNHEALTHY_AFTER_FAILURES = 3;

/** In-process guard so a single worker never overlaps two runs for one provider. */
const inProcessLocks = new Set<string>();

function nowIso(): string {
  return new Date().toISOString();
}

function timeOf(value: unknown): number | null {
  if (!value) return null;
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) ? time : null;
}

export function computeHealthStatus(state: ProviderState, now = new Date()): ProviderState["status"] {
  if (!state.isEnabled) return "DISABLED";

  const lockExpiry = timeOf(state.lockExpiresAt);
  if (lockExpiry && lockExpiry > now.getTime()) return "SYNCING";

  const failures = state.consecutiveFailures || 0;
  if (failures >= UNHEALTHY_AFTER_FAILURES) return "UNHEALTHY";

  const lastSync = timeOf(state.lastSyncAt);
  const overdue = lastSync
    ? now.getTime() - lastSync > syncIntervalMinutes(state.provider) * 2 * 60 * 1000
    : false;

  if (failures >= WARNING_AFTER_FAILURES || overdue) return "WARNING";
  if (!state.lastSuccessAt && !lastSync) return "IDLE";
  return "HEALTHY";
}

/** Loads (creating on first use) the persisted state row for a provider. */
export async function getProviderState(provider: string): Promise<ProviderState> {
  const name = provider.toUpperCase();
  const existing = (await db.providerState.findFirst({ where: { provider: name } })) as
    | ProviderState
    | null;
  if (existing) {
    const status = computeHealthStatus(existing);
    if (status !== existing.status) {
      return (await db.providerState.update({
        where: { id: existing.id },
        data: { status },
      })) as ProviderState;
    }
    return existing;
  }

  const providerInfo = getProviderInfo().find((info) => info.name === name);
  const created = (await db.providerState.create({
    data: {
      provider: name,
      isEnabled: providerInfo ? providerInfo.isConfigured : true,
      status: "IDLE",
      consecutiveFailures: 0,
      jobsImported: 0,
      activeJobs: 0,
      syncIntervalMinutes: syncIntervalMinutes(name),
      freshnessHours: freshnessHours(name),
    },
  })) as ProviderState;

  return created;
}

export async function listProviderStates(providers = ["ADZUNA", "GREENHOUSE", "LEVER"]) {
  const states: ProviderState[] = [];
  for (const provider of providers) {
    states.push(await getProviderState(provider));
  }
  return states;
}

export async function setProviderEnabled(provider: string, isEnabled: boolean) {
  const state = await getProviderState(provider);
  return (await db.providerState.update({
    where: { id: state.id },
    data: { isEnabled, status: isEnabled ? computeHealthStatus({ ...state, isEnabled }) : "DISABLED" },
  })) as ProviderState;
}

/**
 * Distributed-ish lock: only one worker may ingest a provider at a time.
 * Stale locks (worker crash) are reclaimed after `lockTtlMs`.
 */
export async function acquireProviderLock(
  provider: string,
  owner: string,
  lockTtlMs = DEFAULT_LOCK_TTL_MS
): Promise<boolean> {
  const name = provider.toUpperCase();
  if (inProcessLocks.has(name)) return false;

  const state = await getProviderState(name);
  const now = Date.now();
  const lockExpiry = timeOf(state.lockExpiresAt);

  if (lockExpiry && lockExpiry > now && state.lockOwner && state.lockOwner !== owner) {
    log.warn("provider lock held by another worker", {
      provider: name,
      holder: state.lockOwner,
      expiresAt: state.lockExpiresAt,
    });
    return false;
  }

  const updated = (await db.providerState.update({
    where: { id: state.id },
    data: {
      lockOwner: owner,
      lockExpiresAt: new Date(now + lockTtlMs).toISOString(),
      status: "SYNCING",
    },
  })) as ProviderState;

  if (updated.lockOwner !== owner) return false;

  inProcessLocks.add(name);
  return true;
}

export async function releaseProviderLock(provider: string, owner: string): Promise<void> {
  const name = provider.toUpperCase();
  inProcessLocks.delete(name);

  const state = (await db.providerState.findFirst({ where: { provider: name } })) as
    | ProviderState
    | null;
  if (!state || state.lockOwner !== owner) return;

  await db.providerState.update({
    where: { id: state.id },
    data: {
      lockOwner: null,
      lockExpiresAt: null,
      status: computeHealthStatus({ ...state, lockOwner: null, lockExpiresAt: null }),
    },
  });
}

export function newLockOwner(label = "worker"): string {
  return `${label}-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
}

/* -------------------------------------------------------------------------- */
/* Sync run history                                                           */
/* -------------------------------------------------------------------------- */

export async function startSyncRun(
  provider: string,
  triggeredBy = "scheduler"
): Promise<ProviderSyncRun> {
  return (await db.providerSyncRun.create({
    data: {
      provider: provider.toUpperCase(),
      status: "RUNNING",
      triggeredBy,
      startedAt: nowIso(),
    },
  })) as ProviderSyncRun;
}

export async function finishSyncRun(
  runId: string,
  status: ProviderSyncRun["status"],
  stats?: unknown,
  error?: string
): Promise<void> {
  try {
    await db.providerSyncRun.update({
      where: { id: runId },
      data: {
        status,
        stats: stats ?? null,
        error: error ? error.slice(0, 2000) : null,
        finishedAt: nowIso(),
      },
    });
  } catch (err) {
    log.warn("failed to persist sync run", { runId, error: (err as Error).message });
  }
}

export async function listSyncRuns(provider?: string, limit = 25) {
  const where = provider ? { provider: provider.toUpperCase() } : {};
  const runs = (await db.providerSyncRun.findMany({
    where,
    orderBy: { startedAt: "desc" },
  })) as ProviderSyncRun[];
  return runs.slice(0, limit);
}

/** Records a successful provider sync and refreshes its health counters. */
export async function markProviderSuccess(
  provider: string,
  data: { jobsImported?: number; activeJobs?: number }
): Promise<ProviderState> {
  const state = await getProviderState(provider);
  const timestamp = nowIso();
  const merged: ProviderState = {
    ...state,
    isEnabled: true,
    lastSyncAt: timestamp,
    lastSuccessAt: timestamp,
    lastError: null,
    lastErrorAt: state.lastErrorAt ?? null,
    consecutiveFailures: 0,
    lockOwner: null,
    lockExpiresAt: null,
    jobsImported: data.jobsImported ?? state.jobsImported,
    activeJobs: data.activeJobs ?? state.activeJobs,
  };

  return (await db.providerState.update({
    where: { id: state.id },
    data: {
      isEnabled: merged.isEnabled,
      lastSyncAt: merged.lastSyncAt,
      lastSuccessAt: merged.lastSuccessAt,
      lastError: null,
      consecutiveFailures: 0,
      lockOwner: null,
      lockExpiresAt: null,
      jobsImported: merged.jobsImported,
      activeJobs: merged.activeJobs,
      status: computeHealthStatus(merged),
    },
  })) as ProviderState;
}

/** Records a provider failure without breaking the rest of the platform. */
export async function markProviderFailure(provider: string, error: unknown): Promise<ProviderState> {
  const state = await getProviderState(provider);
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  const timestamp = nowIso();

  const merged: ProviderState = {
    ...state,
    lastSyncAt: timestamp,
    lastErrorAt: timestamp,
    lastError: message.slice(0, 1000),
    consecutiveFailures: (state.consecutiveFailures || 0) + 1,
    lockOwner: null,
    lockExpiresAt: null,
  };

  log.error("provider sync failed", {
    provider: merged.provider,
    consecutiveFailures: merged.consecutiveFailures,
    error: message,
  });

  return (await db.providerState.update({
    where: { id: state.id },
    data: {
      lastSyncAt: merged.lastSyncAt,
      lastErrorAt: merged.lastErrorAt,
      lastError: merged.lastError,
      consecutiveFailures: merged.consecutiveFailures,
      lockOwner: null,
      lockExpiresAt: null,
      status: computeHealthStatus(merged),
    },
  })) as ProviderState;
}

/** Aggregated provider health used by `/api/admin/providers`. */
export async function providerHealthReport() {
  const states = await listProviderStates();
  const info = getProviderInfo();
  const sources = await db.jobSource.findMany({});
  const jobs = await db.job.findMany({ where: { isActive: true } });

  return states.map((state) => {
    const meta = info.find((entry) => entry.name === state.provider);
    const providerJobs = jobs.filter(
      (job: { provider?: string }) => String(job.provider || "").toUpperCase() === state.provider
    );
    const providerSources = sources.filter(
      (source: { provider?: string }) => String(source.provider || "").toUpperCase() === state.provider
    );

    return {
      provider: state.provider,
      label: meta?.label || state.provider,
      isEnabled: state.isEnabled,
      isConfigured: meta?.isConfigured ?? isProviderConfigured(state.provider as never),
      requiresSource: meta?.requiresSource ?? false,
      requiredEnv: meta?.requiredEnv || [],
      status: computeHealthStatus(state),
      lastSyncAt: state.lastSyncAt || null,
      lastSuccessAt: state.lastSuccessAt || null,
      lastErrorAt: state.lastErrorAt || null,
      lastError: state.lastError || null,
      consecutiveFailures: state.consecutiveFailures || 0,
      jobsImported: state.jobsImported || 0,
      activeJobs: providerJobs.length,
      configuredSources: providerSources.length,
      activeSources: providerSources.filter(
        (source: { active?: boolean; isActive?: boolean }) =>
          source.active !== false && source.isActive !== false
      ).length,
      syncIntervalMinutes: state.syncIntervalMinutes || syncIntervalMinutes(state.provider),
      freshnessHours: state.freshnessHours || freshnessHours(state.provider),
      isSyncing: computeHealthStatus(state) === "SYNCING",
      lockOwner: state.lockOwner || null,
    };
  });
}

export function defaultFreshnessHours(): Record<string, number> {
  return { ...DEFAULT_FRESHNESS_HOURS };
}
