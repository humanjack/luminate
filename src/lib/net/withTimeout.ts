/**
 * fetch with a hard timeout. Composes the caller's `init.signal` with an
 * internal AbortController so an upstream cancel still propagates, and always
 * clears the timer in `finally`. A hung/slow upstream aborts after `ms` instead
 * of blocking the request indefinitely.
 */
export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  ms = 15_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  // Chain a caller-provided signal so either source can abort.
  const callerSignal = init.signal;
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
