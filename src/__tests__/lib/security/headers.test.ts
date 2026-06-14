import { describe, it, expect } from "vitest";
import { securityHeaders, contentSecurityPolicy } from "@/lib/security/headers";

describe("securityHeaders", () => {
  it("includes the core hardening headers", () => {
    const map = new Map(securityHeaders(false).map((h) => [h.key, h.value]));
    expect(map.get("X-Content-Type-Options")).toBe("nosniff");
    expect(map.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(map.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(map.get("Permissions-Policy")).toContain("microphone=(self)");
    expect(map.has("Content-Security-Policy-Report-Only")).toBe(true);
  });

  it("only emits HSTS in production", () => {
    const dev = new Map(securityHeaders(false).map((h) => [h.key, h.value]));
    const prod = new Map(securityHeaders(true).map((h) => [h.key, h.value]));
    expect(dev.has("Strict-Transport-Security")).toBe(false);
    expect(prod.get("Strict-Transport-Security")).toContain("max-age=");
  });

  it("ships CSP as report-only (non-breaking) with safe directives", () => {
    const map = new Map(securityHeaders(false).map((h) => [h.key, h.value]));
    expect(map.has("Content-Security-Policy")).toBe(false); // not enforcing yet
    const csp = contentSecurityPolicy();
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("https://api.anthropic.com"); // LLM endpoint allowed
    expect(csp).toContain("media-src 'self' blob:"); // recording/ffmpeg blobs
  });
});
