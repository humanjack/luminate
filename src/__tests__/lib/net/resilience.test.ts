import { describe, it, expect, vi, afterEach } from "vitest";
import { withRetry } from "@/lib/net/withRetry";
import { fetchWithTimeout } from "@/lib/net/withTimeout";
import { fetchResilient } from "@/lib/net";

const noSleep = async () => {};
function abortError() {
  return Object.assign(new Error("aborted"), { name: "AbortError" });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("withRetry", () => {
  it("retries a retryable result then succeeds", async () => {
    let n = 0;
    const fn = vi.fn(async () => ({ status: n++ === 0 ? 503 : 200 }));
    const res = await withRetry(fn, {
      retries: 2,
      isRetryable: (r) => r.status >= 500,
      sleep: noSleep,
      random: () => 0,
    });
    expect(res.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-retryable result", async () => {
    const fn = vi.fn(async () => ({ status: 400 }));
    const res = await withRetry(fn, { retries: 3, isRetryable: (r) => r.status >= 500, sleep: noSleep });
    expect(res.status).toBe(400);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry an AbortError", async () => {
    const fn = vi.fn(async () => {
      throw abortError();
    });
    await expect(withRetry(fn, { retries: 3, sleep: noSleep })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a network error then succeeds", async () => {
    let n = 0;
    const fn = vi.fn(async () => {
      if (n++ === 0) throw new TypeError("network");
      return { status: 200 };
    });
    const res = await withRetry(fn, { retries: 2, sleep: noSleep });
    expect(res.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("honors a server-suggested retry delay", async () => {
    const delays: number[] = [];
    let n = 0;
    const fn = vi.fn(async () => ({ status: n++ === 0 ? 503 : 200 }));
    await withRetry(fn, {
      retries: 2,
      isRetryable: (r) => r.status >= 500,
      retryAfterMs: () => 1234,
      maxDelayMs: 10_000,
      sleep: async (ms) => {
        delays.push(ms);
      },
    });
    expect(delays).toEqual([1234]);
  });

  it("gives up after the retry budget and returns the last result", async () => {
    const fn = vi.fn(async () => ({ status: 503 }));
    const res = await withRetry(fn, { retries: 2, isRetryable: (r) => r.status >= 500, sleep: noSleep });
    expect(res.status).toBe(503);
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

describe("fetchWithTimeout", () => {
  it("aborts after timeoutMs", async () => {
    vi.useFakeTimers();
    vi.spyOn(global, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const sig = (init as RequestInit).signal!;
          sig.addEventListener("abort", () => reject(abortError()));
        })
    );
    const p = fetchWithTimeout("https://x", {}, 1000);
    // Attach the rejection handler before advancing time so the abort never
    // sits as a momentarily-unhandled rejection.
    const assertion = expect(p).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("returns the response and clears the timer on success", async () => {
    vi.useFakeTimers();
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
    const res = await fetchWithTimeout("https://x", {}, 1000);
    expect(res.status).toBe(200);
    expect(vi.getTimerCount()).toBe(0); // timer was cleared
  });

  it("aborts immediately when the caller signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    vi.spyOn(global, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const sig = (init as RequestInit).signal!;
          if (sig.aborted) reject(abortError());
          else sig.addEventListener("abort", () => reject(abortError()));
        })
    );
    await expect(
      fetchWithTimeout("https://x", { signal: ac.signal }, 5000)
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("fetchResilient", () => {
  it("returns a non-retryable response without retrying", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
    const res = await fetchResilient("https://x");
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledOnce();
  });
});
