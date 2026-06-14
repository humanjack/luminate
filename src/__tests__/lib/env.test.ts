import { describe, it, expect, afterEach, vi } from "vitest";

// env.ts parses at module load, so each case resets modules and re-imports.
async function loadEnv() {
  vi.resetModules();
  return (await import("@/lib/env")).env;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env", () => {
  it("defaults BACKEND_URL to localhost when unset", async () => {
    vi.stubEnv("BACKEND_URL", undefined as unknown as string);
    const env = await loadEnv();
    expect(env.BACKEND_URL).toBe("http://localhost:8000");
  });

  it("accepts a valid URL", async () => {
    vi.stubEnv("BACKEND_URL", "http://backend:8000");
    const env = await loadEnv();
    expect(env.BACKEND_URL).toBe("http://backend:8000");
  });

  it("accepts an empty string (disables backend sync) consistently", async () => {
    vi.stubEnv("BACKEND_URL", "");
    const env = await loadEnv();
    expect(env.BACKEND_URL).toBe("");
  });

  it("throws a descriptive error on a malformed URL (fail-fast)", async () => {
    vi.stubEnv("BACKEND_URL", "notaurl");
    await expect(loadEnv()).rejects.toThrow(/Invalid environment configuration/);
  });
});
