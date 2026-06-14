/**
 * Retry a fallible async operation with full-jitter exponential backoff.
 *
 * Retries on transient failures only: network/connection errors and the
 * configured retryable HTTP statuses (via `isRetryable`). Never retries an
 * AbortError (timeout/cancel) or a non-retryable status. Honors `Retry-After`
 * when the caller surfaces it through `retryAfterMs`.
 */
export interface RetryOptions<T> {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Return true if this successful result should still be retried (e.g. a 503). */
  isRetryable?: (result: T) => boolean;
  /** Extract a server-suggested delay (ms) from the result, if any. */
  retryAfterMs?: (result: T) => number | undefined;
  onRetry?: (info: { attempt: number; delayMs: number; error?: unknown; result?: T }) => void;
  /** Injectable sleep (tests). */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable jitter in [0,1) (tests). */
  random?: () => number;
}

export const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "AbortError" || err.name === "TimeoutError")
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions<T> = {}
): Promise<T> {
  const retries = opts.retries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 300;
  const maxDelayMs = opts.maxDelayMs ?? 8_000;
  const sleep = opts.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = opts.random ?? Math.random;

  const backoff = (attempt: number, suggested?: number): number => {
    if (typeof suggested === "number" && suggested >= 0) return Math.min(suggested, maxDelayMs);
    const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
    return Math.floor(random() * cap); // full jitter
  };

  let attempt = 0;
  for (;;) {
    try {
      const result = await fn();
      if (attempt < retries && opts.isRetryable?.(result)) {
        const delayMs = backoff(attempt, opts.retryAfterMs?.(result));
        opts.onRetry?.({ attempt: attempt + 1, delayMs, result });
        attempt++;
        await sleep(delayMs);
        continue;
      }
      return result;
    } catch (error) {
      if (attempt < retries && !isAbortError(error)) {
        const delayMs = backoff(attempt);
        opts.onRetry?.({ attempt: attempt + 1, delayMs, error });
        attempt++;
        await sleep(delayMs);
        continue;
      }
      throw error;
    }
  }
}
