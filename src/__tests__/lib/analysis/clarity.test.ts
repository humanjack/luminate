import { describe, expect, it } from "vitest";
import { computeClarity, highlightFillers } from "@/lib/analysis/clarity";

describe("analysis/computeClarity", () => {
  it("scores 100 when there are no fillers and no long silences", () => {
    const out = computeClarity({
      scriptText: "Hello there my friends this is a clean take",
      fillerWords: [],
    });
    expect(out.score).toBe(100);
    expect(out.totalFillers).toBe(0);
  });

  it("drops the score in proportion to filler density", () => {
    // 5 fillers in 50 words → 10 per 100 → 100 - 10*2 = 80
    const script = Array(50).fill("word").join(" ");
    const out = computeClarity({
      scriptText: script,
      fillerWords: [
        { word: "um", count: 3 },
        { word: "ah", count: 2 },
      ],
    });
    expect(out.totalFillers).toBe(5);
    expect(out.wordCount).toBe(50);
    expect(out.fillersPer100Words).toBe(10);
    expect(out.score).toBe(80);
  });

  it("each 5 fillers per 100 words costs about 10 clarity points", () => {
    const base = computeClarity({
      scriptText: Array(100).fill("x").join(" "),
      fillerWords: [],
    });
    const noisy = computeClarity({
      scriptText: Array(100).fill("x").join(" "),
      fillerWords: [{ word: "um", count: 5 }],
    });
    expect(base.score - noisy.score).toBe(10);
  });

  it("computes a non-zero long-silence ratio when most of the waveform is silent", () => {
    // 10 seconds @ 10 samples/sec = 100 samples; first 80 silent (8s solid silence)
    const waveform = Array.from({ length: 100 }, (_, i) => (i < 80 ? 0 : 0.6));
    const out = computeClarity({
      scriptText: "spoken bit",
      fillerWords: [],
      waveform,
      durationSec: 10,
      silenceThreshold: 0.1,
      minLongSilenceSec: 0.8,
    });
    expect(out.longSilenceRatio).toBeGreaterThan(0.7);
    expect(out.score).toBeLessThan(80);
  });

  it("ignores brief silences below the threshold (normal speech rhythm)", () => {
    // Mostly loud, with single-sample (0.1s) silences sprinkled in
    const waveform = Array.from({ length: 50 }, (_, i) => (i % 5 === 0 ? 0 : 0.8));
    const out = computeClarity({
      scriptText: "a normal speaker",
      fillerWords: [],
      waveform,
      durationSec: 5,
    });
    expect(out.longSilenceRatio).toBe(0);
  });

  it("never returns NaN for an empty script", () => {
    const out = computeClarity({ scriptText: "", fillerWords: [{ word: "um", count: 3 }] });
    expect(Number.isFinite(out.score)).toBe(true);
    expect(out.fillersPer100Words).toBe(0);
  });

  it("clamps the score into [0, 100]", () => {
    // Catastrophic case: short script, many fillers, lots of silence
    const waveform = Array(200).fill(0);
    const out = computeClarity({
      scriptText: "um um",
      fillerWords: [{ word: "um", count: 50 }],
      waveform,
      durationSec: 5,
    });
    expect(out.score).toBeGreaterThanOrEqual(0);
    expect(out.score).toBeLessThanOrEqual(100);
  });
});

describe("analysis/highlightFillers", () => {
  it("wraps every filler occurrence in a <mark> tag", () => {
    const out = highlightFillers("Um, well, you know, like the thing", [
      { word: "um", count: 1 },
      { word: "well", count: 1 },
      { word: "like", count: 1 },
    ]);
    const marks = out.match(/<mark/g)?.length ?? 0;
    expect(marks).toBe(3);
  });

  it("does not wrap non-filler words", () => {
    const out = highlightFillers("This is fine", [{ word: "um", count: 0 }]);
    expect(out).not.toMatch(/<mark/);
    expect(out).toContain("This is fine");
  });

  it("escapes HTML special chars in the source text", () => {
    const out = highlightFillers("Wait <em>uh</em>, no — ah!", [
      { word: "uh", count: 1 },
      { word: "ah", count: 1 },
    ]);
    // Source HTML must be neutralised so an unsafe slide title can't
    // sneak a tag into the rendered practice script.
    expect(out).not.toContain("<em>");
    expect(out).toContain("&lt;em&gt;");
    // Real filler tokens delimited by whitespace/punctuation still get marked.
    expect(out).toMatch(/<mark[^>]*>ah<\/mark>/);
  });

  it("matches case-insensitively", () => {
    const out = highlightFillers("UM... Uh,", [{ word: "um", count: 1 }, { word: "uh", count: 1 }]);
    expect(out).toMatch(/<mark[^>]*>UM<\/mark>/);
    expect(out).toMatch(/<mark[^>]*>Uh<\/mark>/);
  });

  it("returns empty string for empty input", () => {
    expect(highlightFillers("", [])).toBe("");
  });
});
