import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Helper to create mock NextRequest
function createMockRequest(body?: any): NextRequest {
  return new NextRequest("http://localhost:3000/api/settings/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Settings Verification API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("POST /api/settings/verify/elsa", () => {
    it("should return error when API key is missing", async () => {
      const { POST } = await import("@/app/api/settings/verify/elsa/route");

      const request = createMockRequest({});
      const response = await POST(request);
      const data = await response.json();

      expect(data.valid).toBe(false);
      expect(data.error).toContain("API key is required");
    });

    it("should validate key format as fallback", async () => {
      // Mock fetch to simulate API unavailable
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      vi.resetModules();
      const { POST } = await import("@/app/api/settings/verify/elsa/route");

      // Key with valid format (>= 20 chars)
      const request = createMockRequest({
        apiKey: "a".repeat(25),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.valid).toBe(true);
      expect(data.warning).toBeDefined();
    });

    it("should return invalid for short key format", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      vi.resetModules();
      const { POST } = await import("@/app/api/settings/verify/elsa/route");

      const request = createMockRequest({
        apiKey: "short",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.valid).toBe(false);
    });

    it("should return valid when API responds OK", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      vi.resetModules();
      const { POST } = await import("@/app/api/settings/verify/elsa/route");

      const request = createMockRequest({
        apiKey: "valid-elsa-api-key-12345",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.valid).toBe(true);
    });

    it("should return invalid for 401/403 responses", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      vi.resetModules();
      const { POST } = await import("@/app/api/settings/verify/elsa/route");

      const request = createMockRequest({
        apiKey: "invalid-key-12345678901234567890",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.valid).toBe(false);
      expect(data.error).toContain("Invalid API key");
    });
  });

  describe("POST /api/settings/verify/speechsuper", () => {
    it("should return error when credentials are missing", async () => {
      const { POST } = await import(
        "@/app/api/settings/verify/speechsuper/route"
      );

      const request = createMockRequest({});
      const response = await POST(request);
      const data = await response.json();

      expect(data.valid).toBe(false);
      expect(data.error).toContain("required");
    });

    it("should return error when only API key is provided", async () => {
      const { POST } = await import(
        "@/app/api/settings/verify/speechsuper/route"
      );

      const request = createMockRequest({ apiKey: "test-key" });
      const response = await POST(request);
      const data = await response.json();

      expect(data.valid).toBe(false);
      expect(data.error).toContain("required");
    });

    it("should return error when only App ID is provided", async () => {
      const { POST } = await import(
        "@/app/api/settings/verify/speechsuper/route"
      );

      const request = createMockRequest({ appId: "test-app" });
      const response = await POST(request);
      const data = await response.json();

      expect(data.valid).toBe(false);
      expect(data.error).toContain("required");
    });

    it("should validate credentials format", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      vi.resetModules();
      const { POST } = await import(
        "@/app/api/settings/verify/speechsuper/route"
      );

      // Valid format: apiKey >= 16 chars, appId >= 8 chars, alphanumeric
      const request = createMockRequest({
        apiKey: "a".repeat(20),
        appId: "app12345678",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.valid).toBe(true);
      expect(data.warning).toBeDefined();
    });

    it("should return invalid for short credentials", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      vi.resetModules();
      const { POST } = await import(
        "@/app/api/settings/verify/speechsuper/route"
      );

      const request = createMockRequest({
        apiKey: "short",
        appId: "app",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.valid).toBe(false);
    });
  });

  describe("POST /api/settings/verify/anthropic", () => {
    it("should return error when API key is missing", async () => {
      vi.resetModules();

      // Mock the Anthropic SDK
      vi.doMock("@anthropic-ai/sdk", () => ({
        default: class MockAnthropic {
          messages = {
            create: vi.fn().mockResolvedValue({ model: "test" }),
          };
        },
      }));

      const { POST } = await import("@/app/api/settings/verify/anthropic/route");

      const request = createMockRequest({});
      const response = await POST(request);
      const data = await response.json();

      expect(data.valid).toBe(false);
      expect(data.error).toContain("API key is required");
    });
  });
});
