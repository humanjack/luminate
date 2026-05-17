import { describe, expect, it } from "vitest";
import { sanitizeClips } from "@/lib/clips/sanitize";

const TOTAL = 240;

describe("clips/sanitize", () => {
  it("keeps only well-formed clips with required fields", () => {
    const out = sanitizeClips(
      [
        { startSec: 10, endSec: 40, hook: "good", viralityScore: 80, reasoning: "ok" },
        { startSec: 10, endSec: 40 }, // missing hook
        { hook: "no times", viralityScore: 50 }, // missing times
      ],
      TOTAL
    );
    expect(out).toHaveLength(1);
    expect(out[0].hook).toBe("good");
  });

  it("clamps duration into [15, 60]", () => {
    const out = sanitizeClips(
      [
        { startSec: 0, endSec: 5, hook: "too short", viralityScore: 80, reasoning: "r" },
        { startSec: 100, endSec: 200, hook: "too long", viralityScore: 80, reasoning: "r" },
      ],
      TOTAL
    );
    expect(out).toHaveLength(2);
    const tooShort = out.find((c) => c.hook === "too short")!;
    expect(tooShort.endSec - tooShort.startSec).toBeGreaterThanOrEqual(15);
    const tooLong = out.find((c) => c.hook === "too long")!;
    expect(tooLong.endSec - tooLong.startSec).toBeLessThanOrEqual(60);
  });

  it("normalises reversed start/end", () => {
    const out = sanitizeClips(
      [
        { startSec: 100, endSec: 60, hook: "reversed", viralityScore: 70, reasoning: "r" },
      ],
      TOTAL
    );
    expect(out[0].startSec).toBeLessThan(out[0].endSec);
  });

  it("drops a clip that overlaps an earlier accepted clip by >50%", () => {
    const out = sanitizeClips(
      [
        { startSec: 10, endSec: 40, hook: "first", viralityScore: 90, reasoning: "r" },
        { startSec: 15, endSec: 45, hook: "overlap", viralityScore: 80, reasoning: "r" },
      ],
      TOTAL
    );
    const hooks = out.map((c) => c.hook);
    expect(hooks).toContain("first");
    expect(hooks).not.toContain("overlap");
  });

  it("clamps virality score to [0,100]", () => {
    const out = sanitizeClips(
      [
        { startSec: 10, endSec: 35, hook: "neg", viralityScore: -10, reasoning: "r" },
        { startSec: 60, endSec: 100, hook: "huge", viralityScore: 200, reasoning: "r" },
      ],
      TOTAL
    );
    expect(out.find((c) => c.hook === "neg")?.viralityScore).toBe(0);
    expect(out.find((c) => c.hook === "huge")?.viralityScore).toBe(100);
  });

  it("sorts highest virality first", () => {
    const out = sanitizeClips(
      [
        { startSec: 0, endSec: 25, hook: "low", viralityScore: 40, reasoning: "r" },
        { startSec: 60, endSec: 85, hook: "high", viralityScore: 85, reasoning: "r" },
        { startSec: 120, endSec: 145, hook: "mid", viralityScore: 65, reasoning: "r" },
      ],
      TOTAL
    );
    expect(out.map((c) => c.hook)).toEqual(["high", "mid", "low"]);
  });

  it("caps at six suggestions", () => {
    const big = Array.from({ length: 12 }, (_, i) => ({
      startSec: i * 18,
      endSec: i * 18 + 16,
      hook: `clip ${i}`,
      viralityScore: 80 - i,
      reasoning: "r",
    }));
    const out = sanitizeClips(big, 12 * 18 + 16);
    expect(out.length).toBeLessThanOrEqual(6);
  });
});
