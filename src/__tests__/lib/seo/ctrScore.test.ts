import { describe, expect, it } from "vitest";
import {
  analyzeTitle,
  ctrScoreFromSignals,
  combineScores,
  scoreTitle,
} from "@/lib/seo/ctrScore";

describe("seo/ctrScore", () => {
  it("rewards titles with numbers and curiosity", () => {
    const a = scoreTitle("7 things nobody tells you about Solar Panels");
    const b = scoreTitle("solar panels");
    expect(a).toBeGreaterThan(b);
  });

  it("penalises ALL CAPS titles", () => {
    const shouty = scoreTitle("WHY YOU NEED THIS NOW!!!");
    const calm = scoreTitle("Why you need this now");
    expect(calm).toBeGreaterThan(shouty);
  });

  it("hits the sweet spot at ~50 chars", () => {
    const sweet = scoreTitle("Why Rooftop Solar Quietly Took Over US Power Grid");
    const tooLong = scoreTitle(
      "An extraordinarily detailed and laboriously written exploration into the history of rooftop solar systems"
    );
    expect(sweet).toBeGreaterThan(tooLong);
  });

  it("analyzeTitle decomposes signals", () => {
    const sig = analyzeTitle("7 Secret Tips For Faster Code [2026]");
    expect(sig.hasNumber).toBe(true);
    expect(sig.hasBrackets).toBe(true);
    expect(sig.powerWordCount).toBeGreaterThan(0);
    expect(sig.titleCase).toBe(true);
  });

  it("ctrScoreFromSignals is monotone with power word count", () => {
    const base = analyzeTitle("Why solar matters now");
    const baseScore = ctrScoreFromSignals(base);
    const withPower = analyzeTitle("Why this Ultimate Secret Solar Truth matters now");
    expect(ctrScoreFromSignals(withPower)).toBeGreaterThan(baseScore);
  });

  it("combineScores averages and clamps", () => {
    expect(combineScores(100, 50)).toBe(75);
    expect(combineScores(120, -50)).toBe(50);
    expect(combineScores(0, 0)).toBe(0);
    expect(combineScores(100, 100)).toBe(100);
  });

  it("clamps absurd outputs to 0..100", () => {
    const empty = scoreTitle("");
    const huge = scoreTitle("? ".repeat(200));
    expect(empty).toBeGreaterThanOrEqual(0);
    expect(empty).toBeLessThanOrEqual(100);
    expect(huge).toBeGreaterThanOrEqual(0);
    expect(huge).toBeLessThanOrEqual(100);
  });
});
