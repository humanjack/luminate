import { describe, expect, it } from "vitest";
import { SLIDE_THEMES, THEMES, tokensFor } from "@/lib/slides/themes";

describe("slides/themes", () => {
  it("exports the canonical three themes", () => {
    expect(SLIDE_THEMES).toEqual(["default", "dark", "playful"]);
    for (const t of SLIDE_THEMES) {
      expect(THEMES[t]).toBeDefined();
    }
  });

  it("tokensFor returns the named theme when known", () => {
    expect(tokensFor("dark")).toBe(THEMES.dark);
  });

  it("tokensFor falls back to default for unknown / null", () => {
    expect(tokensFor(null)).toBe(THEMES.default);
    expect(tokensFor(undefined)).toBe(THEMES.default);
    expect(tokensFor("not-a-theme")).toBe(THEMES.default);
  });

  it("each theme defines surface, title, body, and accent tokens", () => {
    for (const t of SLIDE_THEMES) {
      const tokens = THEMES[t];
      expect(tokens.surface).toMatch(/bg-/);
      expect(tokens.title.length).toBeGreaterThan(0);
      expect(tokens.body.length).toBeGreaterThan(0);
      expect(tokens.accent).toMatch(/bg-/);
    }
  });
});
