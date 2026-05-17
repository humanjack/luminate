import { describe, expect, it } from "vitest";
import { sanitizeSeoOutput } from "@/lib/seo/sanitize";
import { parseSeoJson } from "@/lib/seo/prompt";

describe("seo/sanitize", () => {
  const context = {
    slides: [
      { index: 0, markdown: "# Hook" },
      { index: 1, markdown: "# Body" },
    ],
    scripts: [
      { slideIndex: 0, estimatedDuration: 20 },
      { slideIndex: 1, estimatedDuration: 40 },
    ],
  };

  it("keeps up to 5 well-formed titles and rescues malformed ones", () => {
    const raw = {
      titles: [
        { text: "Why Rooftop Solar Is Quietly Winning", ctrScore: 88, reasoning: "curiosity" },
        { title: "7 Things Nobody Tells You About Solar", score: 75, reasoning: "number-led" },
        { reasoning: "missing text — dropped" },
        { text: "Another title", ctrScore: "not a number", reasoning: "still good" },
      ],
      description: "Hook line.\n\n{TIMESTAMPS}\n\nLike & subscribe.",
      tags: ["Solar", "#solar", " solar ", "renewable energy"],
    };

    const out = sanitizeSeoOutput(raw, context);
    expect(out.titles).toHaveLength(3);
    expect(out.titles[0].ctrScore).toBeGreaterThanOrEqual(0);
    expect(out.titles[0].ctrScore).toBeLessThanOrEqual(100);
    expect(out.titles[2].text).toBe("Another title");
  });

  it("substitutes {TIMESTAMPS} with real chapter lines", () => {
    const raw = {
      titles: [],
      description: "Intro.\n\n{TIMESTAMPS}\n\nOutro.",
      tags: [],
    };
    const out = sanitizeSeoOutput(raw, context);
    expect(out.description).toContain("0:00 Hook");
    expect(out.description).toContain("0:20 Body");
    expect(out.description).not.toContain("{TIMESTAMPS}");
  });

  it("appends chapters when no marker is present", () => {
    const raw = { description: "Just intro.", titles: [], tags: [] };
    const out = sanitizeSeoOutput(raw, context);
    expect(out.description).toMatch(/Chapters:[\s\S]*0:00 Hook/);
  });

  it("normalises tags: lowercases, strips #, dedupes, caps at 30", () => {
    const tags = Array.from({ length: 50 }, (_, i) => `Tag${i}`);
    tags.push("#duplicate", "Duplicate");
    const out = sanitizeSeoOutput({ description: "", titles: [], tags }, context);
    expect(out.tags.length).toBeLessThanOrEqual(30);
    expect(out.tags.every((t) => t === t.toLowerCase())).toBe(true);
    expect(new Set(out.tags).size).toBe(out.tags.length);
  });
});

describe("seo/prompt parseSeoJson", () => {
  it("parses plain JSON", () => {
    expect(parseSeoJson('{"titles":[]}')).toEqual({ titles: [] });
  });

  it("tolerates ```json fences", () => {
    const wrapped = "```json\n{\"a\":1}\n```";
    expect(parseSeoJson(wrapped)).toEqual({ a: 1 });
  });

  it("tolerates plain ``` fences", () => {
    const wrapped = "```\n{\"a\":2}\n```";
    expect(parseSeoJson(wrapped)).toEqual({ a: 2 });
  });

  it("throws on garbage", () => {
    expect(() => parseSeoJson("not json")).toThrow();
  });
});
