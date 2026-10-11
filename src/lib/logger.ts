/**
 * Minimal structured logger used by the job ingestion / worker layers.
 *
 * Providers and workers must never log credentials or full upstream payloads.
 * `redact()` scrubs known secret query parameters before anything is written.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  [key: string]: unknown;
}

const SENSITIVE_KEYS = [
  "app_id",
  "app_key",
  "appkey",
  "authorization",
  "api_key",
  "apikey",
  "token",
  "password",
  "secret",
];

export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
        parsed.searchParams.set(key, "***");
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((entry) => redact(entry, depth + 1));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.includes(key.toLowerCase())
        ? "***"
        : redact(entry, depth + 1);
    }
    return out;
  }
  return value;
}

function emit(level: LogLevel, scope: string, message: string, fields?: LogFields) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(fields ? (redact(fields) as LogFields) : {}),
  };

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(scope: string): Logger;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (message, fields) => emit("debug", scope, message, fields),
    info: (message, fields) => emit("info", scope, message, fields),
    warn: (message, fields) => emit("warn", scope, message, fields),
    error: (message, fields) => emit("error", scope, message, fields),
    child: (childScope: string) => createLogger(`${scope}:${childScope}`),
  };
}

export const logger = createLogger("applyswipe");
