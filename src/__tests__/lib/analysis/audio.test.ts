import { describe, it, expect } from "vitest";
import path from "path";
import { resolveAudioFile, recordingsRoot } from "@/lib/analysis/audio";

const ROOT = recordingsRoot();

describe("resolveAudioFile (path-traversal guard)", () => {
  it("resolves a stored /recordings/... path under the recordings root", () => {
    const out = resolveAudioFile("/recordings/p1/r.webm");
    expect(out).toBe(path.join(ROOT, "p1", "r.webm"));
    expect(out.startsWith(ROOT + path.sep)).toBe(true);
  });

  it("resolves a bare recordings/... relative path", () => {
    const out = resolveAudioFile("recordings/p1/r.webm");
    expect(out).toBe(path.join(ROOT, "p1", "r.webm"));
  });

  it("rejects an absolute path outside the root", () => {
    expect(() => resolveAudioFile("/etc/passwd")).toThrow();
    expect(() => resolveAudioFile("/var/secret")).toThrow();
  });

  it("rejects traversal that escapes the recordings root", () => {
    expect(() => resolveAudioFile("/recordings/../../../etc/passwd")).toThrow();
    expect(() => resolveAudioFile("recordings/../../secret")).toThrow();
    expect(() => resolveAudioFile("../../secret")).toThrow();
  });

  it("rejects an absolute path even under a /recordings/ prefix trick", () => {
    // "/recordings//etc/passwd" -> rel "/etc/passwd" -> absolute -> rejected
    expect(() => resolveAudioFile("/recordings//etc/passwd")).toThrow();
  });

  it("keeps a normal nested file inside the root", () => {
    const out = resolveAudioFile("/recordings/proj/sub/clip.webm");
    expect(out.startsWith(ROOT + path.sep)).toBe(true);
  });
});
