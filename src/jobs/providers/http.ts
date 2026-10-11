import type { JobSourceConfig } from "./types";

/**
 * Shared HTTP client for provider adapters.
 *
 * Responsibilities:
 *  - hard request timeouts (a stalled provider must never block the ingestion run)
 *  - bounded retries with exponential backoff + jitter
 *  - rate-limit aware handling (HTTP 429 / Retry-After)
 *  - consistent, credential-safe error reporting
 *
 * It NEVER retries indefinitely and never retries non-idempotent 4xx responses.
 */

export type ProviderErrorKind =
  | "CONFIG"
  | "TIMEOUT"
  | "NETWORK"
  | "RATE_LIMIT"
  | "HTTP"
  | "MALFORMED";

export class ProviderError extends Error {
  public readonly kind: ProviderErrorKind;
  public readonly status?: number;
  public readonly provider?: string;
  public readonly retryable: boolean;
  public readonly url?: string;

  constructor(
    message: string,
    options: {
      kind: ProviderErrorKind;
      status?: number;
      provider?: string;
      retryable?: boolean;
      url?: string;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = "ProviderError";
    this.kind = options.kind;
    this.status = options.status;
    this.provider = options.provider;
    this.retryable = options.retryable ?? false;
    this.url = options.url;
    if (options.cause) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export interface HttpClientOptions {
  provider?: string;
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
  userAgent?: string;
  /** Base delay for exponential backoff (ms). */
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export const DEFAULT_TIMEOUT_MS = Number(process.env.JOBS_HTTP_TIMEOUT_MS || 12000);
export const DEFAULT_RETRIES = Number(process.env.JOBS_HTTP_RETRIES ?? 2);
const DEFAULT_BASE_DELAY_MS = 400;
const DEFAULT_MAX_DELAY_MS = 8000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function backoffDelay(
  attempt: number,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS
): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  const jitter = Math.random() * baseDelayMs;
  return Math.round(exponential + jitter);
}

/** Parses `Retry-After` (seconds or HTTP date) into milliseconds, capped. */
export function parseRetryAfter(header: string | null, capMs = 30000): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(capMs, Math.round(seconds * 1000));
  }
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.min(capMs, Math.max(0, date - Date.now()));
}

export interface FetchJsonOptions extends HttpClientOptions {
  headers?: Record<string, string>;
  method?: string;
  signal?: AbortSignal;
  /** Validate + transform the parsed JSON payload. Throws ProviderError on mismatch. */
  validate?: (payload: unknown) => void;
}

/**
 * Fetches JSON from an upstream provider with timeout + bounded retry.
 * Throws `ProviderError` for every failure mode so callers can classify it.
 */
export async function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions = {}
): Promise<T> {
  const {
    provider = "UNKNOWN",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    fetchImpl = fetch,
    headers = {},
    method = "GET",
    signal,
    validate,
  } = options;

  let lastError: ProviderError | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener("abort", onExternalAbort);

    try {
      const response = await fetchImpl(url, {
        method,
        headers: {
          accept: "application/json",
          "user-agent": options.userAgent || "ApplySwipe-JobIngestion/1.0 (+https://applyswipe.app)",
          ...headers,
        },
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.status === 429) {
        const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
        lastError = new ProviderError(`${provider} rate limited the request`, {
          kind: "RATE_LIMIT",
          status: 429,
          provider,
          retryable: true,
          url,
        });
        if (attempt < retries) {
          await sleep(retryAfter ?? backoffDelay(attempt));
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        const retryable = response.status >= 500;
        lastError = new ProviderError(
          `${provider} responded with HTTP ${response.status}`,
          { kind: "HTTP", status: response.status, provider, retryable, url }
        );
        if (retryable && attempt < retries) {
          await sleep(backoffDelay(attempt));
          continue;
        }
        throw lastError;
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        throw new ProviderError(`${provider} returned a malformed JSON payload`, {
          kind: "MALFORMED",
          status: response.status,
          provider,
          retryable: false,
          url,
          cause: error,
        });
      }

      if (validate) validate(payload);
      return payload as T;
    } catch (error) {
      if (error instanceof ProviderError) {
        if (!error.retryable || attempt >= retries) throw error;
        lastError = error;
        await sleep(backoffDelay(attempt));
        continue;
      }

      const aborted = (error as { name?: string })?.name === "AbortError";
      const wrapped = new ProviderError(
        aborted
          ? `${provider} request timed out after ${timeoutMs}ms`
          : `${provider} request failed: ${(error as Error)?.message || "unknown network error"}`,
        {
          kind: aborted ? "TIMEOUT" : "NETWORK",
          provider,
          retryable: true,
          url,
          cause: error,
        }
      );

      if (attempt >= retries) throw wrapped;
      lastError = wrapped;
      await sleep(backoffDelay(attempt));
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onExternalAbort);
    }
  }

  throw (
    lastError ||
    new ProviderError(`${provider} request failed`, { kind: "NETWORK", provider, url })
  );
}

/** True when the value is an http(s) URL that is safe to hand to a browser. */
export function isSafeExternalUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    // Block loopback / link-local / RFC1918 hosts: provider data must never be
    // able to point users (or our own fetchers) at internal services.
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost")) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split(".").map(Number);
      if (a === 10 || a === 127 || a === 0) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 169 && b === 254) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Best-effort hostname extraction used by fingerprinting. */
export function urlHost(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return new URL(value.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Convenience helpers shared by ATS adapters. */
export function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.\-]/g, ""));
    if (Number.isFinite(parsed) && parsed !== 0) return parsed;
  }
  return undefined;
}

export function compactSource(source: JobSourceConfig): Record<string, unknown> {
  return {
    id: source.id,
    provider: source.provider,
    companyName: source.companyName,
    // board tokens / slugs are not secrets, but we keep payloads minimal
    token: source.boardToken,
  };
}
