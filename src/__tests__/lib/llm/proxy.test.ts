import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { proxyLLMStream } from "@/lib/llm/proxy";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("proxyLLMStream backend-unavailable handling", () => {
  it("returns 504 BACKEND_UNAVAILABLE when the backend times out (abort)", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "AbortError" })
    );
    const res = await proxyLLMStream("/api/llm/content", {}, "Test");
    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.code).toBe("BACKEND_UNAVAILABLE");
    expect(body.error).toMatch(/did not respond/i);
  });

  it("returns 502 BACKEND_UNAVAILABLE on a connection error", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } })
    );
    const res = await proxyLLMStream("/api/llm/content", {}, "Test");
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe("BACKEND_UNAVAILABLE");
    expect(body.error).toMatch(/could not reach/i);
  });

  it("passes a successful streaming response through as text/event-stream", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("data: hi\n\n", { status: 200 })
    );
    const res = await proxyLLMStream("/api/llm/content", {}, "Test");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("forwards a non-ok backend HTTP status", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("boom", { status: 500 })
    );
    const res = await proxyLLMStream("/api/llm/content", {}, "Test");
    expect(res.status).toBe(500);
  });
});
