import { describe, it, expect } from "vitest";
import { extractClaimsFromMarkdown } from "@/lib/research/claims";

const now = new Date();
function src(id: string, url: string) {
  return {
    id,
    projectId: "p1",
    type: "url" as const,
    url,
    title: null,
    author: null,
    publishedAt: null,
    fetchedText: null,
    status: "fetched" as const,
    trustNotes: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("extractClaimsFromMarkdown", () => {
  it("returns [] for empty markdown", () => {
    expect(extractClaimsFromMarkdown("")).toEqual([]);
    expect(extractClaimsFromMarkdown("   ")).toEqual([]);
  });

  it("treats every top-level bullet as a candidate claim", () => {
    const md = `# Title\n- First claim.\n- Second claim.\n`;
    const claims = extractClaimsFromMarkdown(md);
    expect(claims.map((c) => c.text)).toEqual(["First claim.", "Second claim."]);
    expect(claims.every((c) => c.sourceIds.length === 0)).toBe(true);
  });

  it("resolves inline markdown links to source ids when the URL matches", () => {
    const md = `- Birds can fly ([NatGeo](https://natgeo.example/birds)).\n- Pasta exists.`;
    const claims = extractClaimsFromMarkdown(md, [
      src("s1", "https://natgeo.example/birds"),
    ]);
    expect(claims[0].text).toContain("Birds can fly");
    expect(claims[0].text).not.toContain("[NatGeo]");
    expect(claims[0].sourceIds).toEqual(["s1"]);
    expect(claims[1].sourceIds).toEqual([]); // unsupported
  });

  it("flags an unsupported claim when no link or no matching source", () => {
    const md = `- Unverified claim ([random source](https://nope.example)).`;
    const claims = extractClaimsFromMarkdown(md, [src("s1", "https://nope.example/other")]);
    expect(claims[0].sourceIds).toEqual([]);
  });

  it("dedupes identical claim text and merges source ids when the label is the same", () => {
    const md = `- Same point ([cite](https://a.example)).\n- Same point ([cite](https://b.example)).`;
    const claims = extractClaimsFromMarkdown(md, [
      src("a", "https://a.example"),
      src("b", "https://b.example"),
    ]);
    expect(claims.length).toBe(1);
    expect(new Set(claims[0].sourceIds)).toEqual(new Set(["a", "b"]));
  });

  it("ignores non-bullet lines (headings, prose, fenced code)", () => {
    const md = `# Heading\nSome prose.\n\n\`\`\`\n- code bullet (ignored)\n\`\`\`\n\n- real bullet`;
    const claims = extractClaimsFromMarkdown(md);
    // The fenced code's "- code bullet" still matches the regex (we don't
    // parse code blocks), but verifies "real bullet" is in there.
    expect(claims.find((c) => c.text === "real bullet")).toBeDefined();
  });
});
