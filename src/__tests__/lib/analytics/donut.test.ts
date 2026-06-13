import { describe, it, expect } from "vitest";
import { donutSegments } from "@/lib/analytics/donut";

describe("donutSegments", () => {
  it("splits the circle proportionally and lays segments head-to-tail", () => {
    const segs = donutSegments([1, 1, 1, 1], 100);
    expect(segs.map((s) => s.length)).toEqual([25, 25, 25, 25]);
    expect(segs.map((s) => s.offset)).toEqual([-0, -25, -50, -75]);
  });

  it("segment lengths sum to the circumference when total > 0", () => {
    const segs = donutSegments([3, 5, 2], 360);
    const sum = segs.reduce((a, s) => a + s.length, 0);
    expect(sum).toBeCloseTo(360, 6);
  });

  it("returns zero-length segments for all-zero input (no NaN)", () => {
    const segs = donutSegments([0, 0, 0], 100);
    expect(segs.every((s) => s.length === 0)).toBe(true);
    expect(segs.every((s) => Number.isFinite(s.offset))).toBe(true);
  });

  it("gives a single value the whole ring", () => {
    const segs = donutSegments([7], 100);
    expect(segs[0].length).toBe(100);
    expect(segs[0].offset).toBe(-0);
  });
});
