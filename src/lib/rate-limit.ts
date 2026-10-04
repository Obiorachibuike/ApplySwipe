/**
 * Lightweight in-memory rate limiter for public read endpoints
 * (job feed / job search). Sized for a single Node process; a deployment with
 * multiple instances can move the counters to Redis (REDIS_URL is already part
 * of the environment) by swapping this module.
 */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

export interface RateLimitConfig {
  /** Bucket capacity (max burst). */
  limit: number;
  /** Refill rate per minute. */
  perMinute: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
}

export const FEED_RATE_LIMIT: RateLimitConfig = {
  limit: Number(process.env.RATE_LIMIT_FEED_BURST || 30),
  perMinute: Number(process.env.RATE_LIMIT_FEED_PER_MINUTE || 60),
};

export const SEARCH_RATE_LIMIT: RateLimitConfig = {
  limit: Number(process.env.RATE_LIMIT_SEARCH_BURST || 30),
  perMinute: Number(process.env.RATE_LIMIT_SEARCH_PER_MINUTE || 60),
};

function pruneIfNeeded(now: number) {
  if (buckets.size <= MAX_BUCKETS) return;
  buckets.forEach((bucket, key) => {
    if (now - bucket.updatedAt > 10 * 60 * 1000) buckets.delete(key);
  });
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  pruneIfNeeded(now);

  const bucket = buckets.get(key) || { tokens: config.limit, updatedAt: now };
  const elapsedMinutes = (now - bucket.updatedAt) / 60000;
  const refilled = Math.min(config.limit, bucket.tokens + elapsedMinutes * config.perMinute);

  if (refilled < 1) {
    const retryAfterSeconds = Math.ceil(((1 - refilled) / config.perMinute) * 60);
    buckets.set(key, { tokens: refilled, updatedAt: now });
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
      limit: config.limit,
    };
  }

  const tokens = refilled - 1;
  buckets.set(key, { tokens, updatedAt: now });

  return {
    allowed: true,
    remaining: Math.floor(tokens),
    retryAfterSeconds: 0,
    limit: config.limit,
  };
}

/** Best-effort client identifier for anonymous traffic. */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return ip;
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(result.remaining),
  };
  if (!result.allowed) headers["retry-after"] = String(result.retryAfterSeconds);
  return headers;
}
