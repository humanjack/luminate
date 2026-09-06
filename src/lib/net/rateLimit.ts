/**
 * Dependency-free in-memory token-bucket rate limiter.
 *
 * Guards the cost-bearing LLM endpoints against retry storms / refreshing tabs.
 * State is a module-level Map keyed by `bucketName:ip`, with lazy refill on
 * access and periodic eviction of idle buckets. This is SINGLE-INSTANCE /
 * in-memory by design — the right MVP guard for the single-process SQLite
 * runtime, NOT a distributed (Redis) limiter. Set `RATE_LIMIT_DISABLED=1` to
 * bypass (tests/local dev).
 */
export interface RateLimitOptions {
  /** Max burst (tokens available when full). */
  capacity: number;
  /** Tokens added per second. */
  refillPerSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterMs: number;
}

interface Bucket {
  tokens: number;
  last: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

const SWEEP_INTERVAL_MS = 60_000;
const IDLE_TTL_MS = 300_000;

export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "local";
}

function evictIdle(t: number): void {
  for (const [key, b] of buckets) {
    if (t - b.last > IDLE_TTL_MS) buckets.delete(key);
  }
}

/** Core limiter. `t` is injectable for deterministic tests. */
export function rateLimit(
  key: string,
  opts: RateLimitOptions,
  t: number = Date.now()
): RateLimitResult {
  if (process.env.RATE_LIMIT_DISABLED === "1") return { ok: true, retryAfterMs: 0 };

  if (t - lastSweep > SWEEP_INTERVAL_MS) {
    evictIdle(t);
    lastSweep = t;
  }

  let b = buckets.get(key);
  if (!b) {
    b = { tokens: opts.capacity, last: t };
    buckets.set(key, b);
  }

  const elapsedSec = Math.max(0, (t - b.last) / 1000);
  b.tokens = Math.min(opts.capacity, b.tokens + elapsedSec * opts.refillPerSec);
  b.last = t;

  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { ok: true, retryAfterMs: 0 };
  }
  const needed = 1 - b.tokens;
  return { ok: false, retryAfterMs: Math.ceil((needed / opts.refillPerSec) * 1000) };
}

export function checkRateLimit(
  request: Request,
  bucketName: string,
  opts: RateLimitOptions,
  t: number = Date.now()
): RateLimitResult {
  return rateLimit(`${bucketName}:${getClientIp(request)}`, opts, t);
}

/**
 * Convenience for route handlers: returns a 429 Response (with `Retry-After`)
 * when the caller is over the limit, or null to proceed.
 */
export function rateLimited(
  request: Request,
  bucketName: string,
  opts: RateLimitOptions
): Response | null {
  const result = checkRateLimit(request, bucketName, opts);
  if (result.ok) return null;
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded — please slow down.", code: "rate_limited" }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
      },
    }
  );
}

/** Per-endpoint-class limits. Agent runs are expensive (full pipeline). */
export const AGENT_RUN_LIMIT: RateLimitOptions = { capacity: 5, refillPerSec: 0.1 };
export const LLM_CALL_LIMIT: RateLimitOptions = { capacity: 10, refillPerSec: 0.5 };

/** Test-only: clear all buckets. */
export function __resetRateLimiter(): void {
  buckets.clear();
  lastSweep = 0;
}
