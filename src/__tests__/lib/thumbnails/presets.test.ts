import { describe, expect, it } from "vitest";
import { renderAllPresets, renderPreset } from "@/lib/thumbnails/presets";
import { THUMBNAIL_PRESETS } from "@/lib/thumbnails/types";

const ctx = {
  title: "7 Reasons Rooftop Solar Took Over US Energy in 2025",
  topic: "How rooftop solar quietly took over US new energy capacity",
  firstSlideTitle: "The quiet solar takeover",
};

describe("thumbnails/presets", () => {
  it("renders all four presets to non-empty SVG strings", () => {
    const all = renderAllPresets(ctx);
    expect(all.length).toBe(4);
    for (const { preset, svg } of all) {
      expect(THUMBNAIL_PRESETS).toContain(preset);
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      // Sanity: the title should appear somewhere in the SVG (modulo word wrap)
      expect(svg.toLowerCase()).toMatch(/solar|rooftop|reasons|took/);
    }
  });

  it("escapes hostile characters that appear in titles", () => {
    const svg = renderPreset("bold-text", {
      ...ctx,
      title: `</svg><script>alert("x")</script>`,
    });
    expect(svg).not.toMatch(/<script>/);
    expect(svg).toContain("&lt;script&gt;");
  });

  it("variants are visually distinct (different SVG bodies)", () => {
    const all = renderAllPresets(ctx);
    const bodies = new Set(all.map((a) => a.svg));
    expect(bodies.size).toBe(4);
  });

  it("uses the chosen number hook in the numbered preset", () => {
    const svg = renderPreset("numbered-list", { ...ctx, numberHook: "42" });
    expect(svg).toContain(">42<");
  });

  it("question preset always ends the question with a ?", () => {
    const svg = renderPreset("question", { ...ctx, title: "Does this work" });
    expect(svg).toContain("Does this work?");
  });

  it("dimensions are 1280x720 (YouTube standard)", () => {
    const svg = renderPreset("reaction", ctx);
    expect(svg).toContain('width="1280"');
    expect(svg).toContain('height="720"');
  });
});
