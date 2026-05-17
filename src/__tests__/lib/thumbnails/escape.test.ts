import { describe, expect, it } from "vitest";
import { escapeSvgText, pickNumberHook, wrapLines } from "@/lib/thumbnails/escape";

describe("thumbnails/escape", () => {
  it("escapes the five XML/SVG-significant characters", () => {
    expect(escapeSvgText(`<a href="x">A & B's "C"</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;A &amp; B&apos;s &quot;C&quot;&lt;/a&gt;"
    );
  });

  it("escapeSvgText is a no-op on safe text", () => {
    expect(escapeSvgText("Just letters and numbers 42")).toBe(
      "Just letters and numbers 42"
    );
  });
});

describe("thumbnails/wrapLines", () => {
  it("wraps within the char budget and never exceeds the line cap", () => {
    const lines = wrapLines(
      "Rooftop solar quietly became the biggest source of new US power",
      18,
      3
    );
    expect(lines.length).toBeLessThanOrEqual(3);
    lines.forEach((l) => expect(l.length).toBeLessThanOrEqual(19));
  });

  it("appends an ellipsis when the third line still overflows", () => {
    const lines = wrapLines("Word ".repeat(40), 12, 3);
    expect(lines.length).toBe(3);
    expect(lines[2].endsWith("…")).toBe(true);
  });

  it("returns a single line for short input", () => {
    expect(wrapLines("hello", 20, 3)).toEqual(["hello"]);
  });
});

describe("thumbnails/pickNumberHook", () => {
  it("returns the first digit run found", () => {
    expect(pickNumberHook("7 secrets nobody tells you")).toBe("7");
    expect(pickNumberHook("Why 2025 will be the year")).toBe("2025");
  });

  it("falls back when no number is present", () => {
    expect(pickNumberHook("Solar takeover")).toBe("7");
    expect(pickNumberHook("Solar takeover", "3")).toBe("3");
  });
});
