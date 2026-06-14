import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  rateLimit,
  getClientIp,
  checkRateLimit,
  rateLimited,
  __resetRateLimiter,
} from "@/lib/net/rateLimit";

beforeEach(() => __resetRateLimiter());
afterEach(() => vi.unstubAllEnvs());

describe("rateLimit (token bucket)", () => {
  it("allows up to capacity immediate calls, then blocks with a Retry-After", () => {
    const opts = { capacity: 3, refillPerSec: 0.1 };
    const t = 1000;
    expect(rateLimit("k", opts, t).ok).toBe(true);
    expect(rateLimit("k", opts, t).ok).toBe(true);
    expect(rateLimit("k", opts, t).ok).toBe(true);
    const blocked = rateLimit("k", opts, t);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("refills tokens over time", () => {
    const opts = { capacity: 1, refillPerSec: 1 };
    expect(rateLimit("r", opts, 0).ok).toBe(true);
    expect(rateLimit("r", opts, 0).ok).toBe(false);
    expect(rateLimit("r", opts, 1000).ok).toBe(true); // 1s later → 1 token back
  });

  it("treats distinct keys independently", () => {
    const opts = { capacity: 1, refillPerSec: 0.1 };
    expect(rateLimit("a", opts, 0).ok).toBe(true);
    expect(rateLimit("b", opts, 0).ok).toBe(true);
    expect(rateLimit("a", opts, 0).ok).toBe(false);
  });

  it("bypasses entirely when RATE_LIMIT_DISABLED=1", () => {
    vi.stubEnv("RATE_LIMIT_DISABLED", "1");
    const opts = { capacity: 1, refillPerSec: 0.1 };
    expect(rateLimit("z", opts, 0).ok).toBe(true);
    expect(rateLimit("z", opts, 0).ok).toBe(true);
  });
});

describe("getClientIp", () => {
  it("uses the first x-forwarded-for hop, then x-real-ip, then a fallback", () => {
    expect(
      getClientIp(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } }))
    ).toBe("1.2.3.4");
    expect(getClientIp(new Request("http://x", { headers: { "x-real-ip": "9.9.9.9" } }))).toBe(
      "9.9.9.9"
    );
    expect(getClientIp(new Request("http://x"))).toBe("local");
  });
});

describe("checkRateLimit / rateLimited", () => {
  it("scopes by bucket+ip and returns a 429 Response on overflow", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.1.1.1" } });
    const opts = { capacity: 1, refillPerSec: 0.1 };
    expect(checkRateLimit(req, "ep", opts, 0).ok).toBe(true);
    expect(checkRateLimit(req, "ep", opts, 0).ok).toBe(false);
  });

  it("rateLimited returns null while under the limit and a 429 once over", async () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "2.2.2.2" } });
    const opts = { capacity: 1, refillPerSec: 0.1 };
    expect(rateLimited(req, "ep2", opts)).toBeNull();
    const res = rateLimited(req, "ep2", opts);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get("Retry-After")).toBeTruthy();
    expect((await res!.json()).code).toBe("rate_limited");
  });
});
