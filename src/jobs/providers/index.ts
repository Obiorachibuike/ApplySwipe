import { AdzunaAdapter, adzunaAdapter } from "./adzuna";
import { GreenhouseAdapter, greenhouseAdapter } from "./greenhouse";
import { LeverAdapter, leverAdapter } from "./lever";
import { PROVIDER_NAMES } from "./types";
import type { JobProvider, ProviderInfo, ProviderName } from "./types";

export * from "./types";
export { AdzunaAdapter, GreenhouseAdapter, LeverAdapter };
export { adzunaAdapter, greenhouseAdapter, leverAdapter };

const REGISTRY: Record<ProviderName, JobProvider> = {
  ADZUNA: adzunaAdapter,
  GREENHOUSE: greenhouseAdapter,
  LEVER: leverAdapter,
};

/**
 * Provider registry.
 *
 * Adding a future provider (Ashby, SmartRecruiters, Recruitee, BambooHR,
 * Personio, Workday, Remotive, RemoteOK, …) means writing an adapter that
 * implements `JobProvider` and registering it here + in PROVIDER_NAMES.
 * Nothing else in the job system needs to change.
 */
export function getProvider(name: string): JobProvider {
  const provider = REGISTRY[name.toUpperCase() as ProviderName];
  if (!provider) {
    throw new Error(`Unknown job provider: ${name}`);
  }
  return provider;
}

export function hasProvider(name: string): boolean {
  return Boolean(REGISTRY[name.toUpperCase() as ProviderName]);
}

export function listProviders(): ProviderName[] {
  return [...PROVIDER_NAMES];
}

/** Env vars a provider needs before it can be enabled (names only - never values). */
const REQUIRED_ENV: Record<ProviderName, string[]> = {
  ADZUNA: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"],
  GREENHOUSE: [],
  LEVER: [],
};

export function isProviderConfigured(name: ProviderName): boolean {
  if (name === "ADZUNA") return adzunaAdapter.isConfigured();
  return true;
}

/** Safe to expose to admins: capability + configuration state, no secrets. */
export function getProviderInfo(): ProviderInfo[] {
  return listProviders().map((name) => {
    const provider = REGISTRY[name];
    return {
      name,
      label: provider.label,
      requiresSource: provider.requiresSource,
      supportsSearch: provider.supportsSearch,
      requiredEnv: REQUIRED_ENV[name],
      isConfigured: isProviderConfigured(name),
    };
  });
}

export function getMissingEnv(name: string): string[] {
  const provider = name.toUpperCase() as ProviderName;
  const required = REQUIRED_ENV[provider] || [];
  return required.filter((key) => !process.env[key]);
}
