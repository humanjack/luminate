import { fetchWithTimeout } from "./withTimeout";
import { withRetry, RETRYABLE_STATUSES } from "./withRetry";

export { fetchWithTimeout } from "./withTimeout";
export { withRetry, RETRYABLE_STATUSES } from "./withRetry";

function retryAfterMs(res: Response): number | undefined {
  const header = res.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

export interface ResilientFetchOptions {
  timeoutMs?: number;
  retries?: number;
}

/**
 * fetch with a per-attempt timeout AND bounded retries on transient failures
 * (network errors + retryable statuses), honoring `Retry-After`. Use for
 * one-shot JSON/REST calls to third-party APIs. Do NOT use for streaming
 * responses — replaying a half-consumed stream is incorrect (use
 * `fetchWithTimeout` with retries disabled there).
 */
export async function fetchResilient(
  url: string | URL,
  init: RequestInit = {},
  opts: ResilientFetchOptions = {}
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const retries = opts.retries ?? 2;
  return withRetry(() => fetchWithTimeout(url, init, timeoutMs), {
    retries,
    isRetryable: (res) => RETRYABLE_STATUSES.has(res.status),
    retryAfterMs,
  });
}
