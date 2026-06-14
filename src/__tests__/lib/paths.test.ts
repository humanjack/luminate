import { describe, it, expect, afterEach, vi } from "vitest";
import path from "path";
import { dataDir, dbFilePath, mediaRoot } from "@/lib/paths";

afterEach(() => vi.unstubAllEnvs());

describe("paths", () => {
  it("defaults to cwd-based paths when LUMINATE_DATA_DIR is unset (unchanged behavior)", () => {
    vi.stubEnv("LUMINATE_DATA_DIR", undefined as unknown as string);
    expect(dataDir()).toBe(process.cwd());
    expect(dbFilePath()).toBe(path.join(process.cwd(), "luminate.db"));
    expect(mediaRoot()).toBe(path.join(process.cwd(), "public"));
  });

  it("honors LUMINATE_DATA_DIR for the DB and media roots", () => {
    vi.stubEnv("LUMINATE_DATA_DIR", "/data");
    expect(dataDir()).toBe("/data");
    expect(dbFilePath()).toBe(path.join("/data", "luminate.db"));
    expect(mediaRoot()).toBe(path.join("/data", "media"));
  });
});
