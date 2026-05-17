import { describe, expect, it } from "vitest";
import { splitSlides } from "@/lib/agent/runner";

describe("agent/runner splitSlides", () => {
  it("splits a Slidev markdown into individual slides on --- separators", () => {
    const md = `# First\n- a\n- b\n---\n# Second\nbody\n---\n# Third\n`;
    expect(splitSlides(md)).toEqual([
      "# First\n- a\n- b",
      "# Second\nbody",
      "# Third",
    ]);
  });

  it("drops empty slides produced by trailing separators", () => {
    expect(splitSlides("# Only\n---\n")).toEqual(["# Only"]);
    expect(splitSlides("---\n# Only")).toEqual(["# Only"]);
  });

  it("returns [] for empty markdown", () => {
    expect(splitSlides("")).toEqual([]);
    expect(splitSlides("\n\n")).toEqual([]);
  });

  it("handles single-slide input with no separator", () => {
    expect(splitSlides("Just a single block")).toEqual(["Just a single block"]);
  });
});
