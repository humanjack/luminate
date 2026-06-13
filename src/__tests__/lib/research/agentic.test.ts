import { describe, expect, it } from "vitest";

import { computeSearchBudget, MAX_SEARCH_BUDGET, researchEffort } from "@/lib/research/effort";
import { parseSubQuestions, getPlanPrompt } from "@/lib/research/plan";
import { credibilityScore, dedupeAndRankSources, normalizeUrl } from "@/lib/research/rank";

describe("research effort (depth → effort)", () => {
  it("scales breadth/depth with depth", () => {
    expect(researchEffort("quick").subQuestions).toBeLessThan(
      researchEffort("comprehensive").subQuestions,
    );
    expect(researchEffort("comprehensive").iterations).toBeGreaterThan(
      researchEffort("quick").iterations,
    );
  });

  it("treats settings as hard caps over depth defaults", () => {
    const e = researchEffort("comprehensive", { maxSources: 4, maxSearchIterations: 1 });
    expect(e.maxSources).toBe(4); // capped below the comprehensive default (14)
    expect(e.iterations).toBe(1); // capped below the comprehensive default (3)
  });

  it("never raises beyond the depth default when the cap is higher", () => {
    const e = researchEffort("quick", { maxSources: 99, maxSearchIterations: 99 });
    expect(e.maxSources).toBe(researchEffort("quick").maxSources);
    expect(e.iterations).toBe(researchEffort("quick").iterations);
  });
});

describe("search budget", () => {
  it("scales with sub-questions and iterations", () => {
    expect(computeSearchBudget(3, 1)).toBe(6);
    expect(computeSearchBudget(5, 2)).toBe(15);
  });

  it("is bounded by MAX_SEARCH_BUDGET", () => {
    expect(computeSearchBudget(8, 3)).toBe(MAX_SEARCH_BUDGET); // 8*4=32 → capped
  });

  it("never drops below 1", () => {
    expect(computeSearchBudget(0, 0)).toBeGreaterThanOrEqual(1);
  });
});

describe("parseSubQuestions", () => {
  it("parses a raw JSON array", () => {
    expect(parseSubQuestions('["a?", "b?", "c?"]')).toEqual(["a?", "b?", "c?"]);
  });

  it("parses a JSON array wrapped in prose / code fence", () => {
    const text = "Here is the plan:\n```json\n[\"q1\", \"q2\"]\n```\nDone.";
    expect(parseSubQuestions(text)).toEqual(["q1", "q2"]);
  });

  it("drops non-strings and blanks", () => {
    expect(parseSubQuestions('["good", 5, "", "  ", "also good"]')).toEqual([
      "good",
      "also good",
    ]);
  });

  it("returns [] when there is no array", () => {
    expect(parseSubQuestions("no json here")).toEqual([]);
    expect(parseSubQuestions("")).toEqual([]);
  });

  it("plan prompt asks for the requested count", () => {
    expect(getPlanPrompt("topic", "detailed", 5)).toContain("5 focused");
  });
});

describe("source dedup + ranking", () => {
  it("normalizes URLs (trailing slash, fragment)", () => {
    expect(normalizeUrl("https://x.dev/a/#frag")).toBe("https://x.dev/a");
    expect(normalizeUrl("https://x.dev/a")).toBe("https://x.dev/a");
  });

  it("scores primary sources above general and aggregators", () => {
    expect(credibilityScore("https://nasa.gov/x")).toBeGreaterThan(
      credibilityScore("https://example.com/x"),
    );
    expect(credibilityScore("https://example.com/x")).toBeGreaterThan(
      credibilityScore("https://reddit.com/x"),
    );
  });

  it("dedupes by normalized URL and ranks primary first, capped", () => {
    const ranked = dedupeAndRankSources(
      [
        { title: "Blog", url: "https://example.com/a" },
        { title: "Gov", url: "https://nih.gov/b" },
        { title: "Blog dup", url: "https://example.com/a/" }, // dup of #1
        { title: "Reddit", url: "https://reddit.com/c" },
      ],
      2,
    );
    expect(ranked).toHaveLength(2);
    expect(ranked[0].url).toBe("https://nih.gov/b"); // primary ranks first
    expect(ranked.some((r) => r.url.includes("reddit"))).toBe(false); // capped out
  });

  it("enriches the kept entry with a snippet from a duplicate", () => {
    const ranked = dedupeAndRankSources(
      [
        { title: "A", url: "https://x.dev/a" },
        { title: "A", url: "https://x.dev/a", snippet: "evidence" },
      ],
      5,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].snippet).toBe("evidence");
  });
});
