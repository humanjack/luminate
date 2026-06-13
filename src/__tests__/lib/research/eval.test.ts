import { describe, expect, it } from "vitest";

import { RESEARCH_FIXTURES } from "@/lib/research/eval/fixtures";
import { briefMetrics, citationStats } from "@/lib/research/eval/metrics";
import {
  RUBRIC_DIMENSIONS,
  aggregateScores,
  buildJudgePrompt,
  parseRubricScores,
  type RubricScores,
} from "@/lib/research/eval/rubric";

describe("eval fixtures", () => {
  it("has a representative set with unique ids and valid depths", () => {
    expect(RESEARCH_FIXTURES.length).toBeGreaterThanOrEqual(10);
    const ids = RESEARCH_FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of RESEARCH_FIXTURES) {
      expect(["quick", "detailed", "comprehensive"]).toContain(f.depth);
      expect(["evergreen", "recency"]).toContain(f.kind);
      expect(f.expectations.length).toBeGreaterThan(0);
    }
  });

  it("includes both evergreen and recency-sensitive topics", () => {
    const kinds = new Set(RESEARCH_FIXTURES.map((f) => f.kind));
    expect(kinds.has("evergreen")).toBe(true);
    expect(kinds.has("recency")).toBe(true);
  });
});

describe("rubric parsing", () => {
  it("parses a full score object and clamps to 1..5", () => {
    const s = parseRubricScores(
      '{"factualAccuracy":5,"citationAccuracy":9,"completeness":4,"sourceQuality":0,"readability":3,"notes":"ok"}',
    );
    expect(s).not.toBeNull();
    expect(s!.citationAccuracy).toBe(5); // clamped down
    expect(s!.sourceQuality).toBe(1); // clamped up
    expect(s!.notes).toBe("ok");
  });

  it("tolerates code-fence wrapping", () => {
    const text = '```json\n{"factualAccuracy":4,"citationAccuracy":4,"completeness":4,"sourceQuality":4,"readability":4}\n```';
    expect(parseRubricScores(text)).not.toBeNull();
  });

  it("returns null when a dimension is missing or unparseable", () => {
    expect(parseRubricScores('{"factualAccuracy":4}')).toBeNull();
    expect(parseRubricScores("not json")).toBeNull();
  });

  it("judge prompt names all dimensions", () => {
    const p = buildJudgePrompt("topic", "brief");
    for (const dim of RUBRIC_DIMENSIONS) expect(p).toContain(dim);
  });
});

describe("aggregateScores", () => {
  const mk = (n: number): RubricScores => ({
    factualAccuracy: n,
    citationAccuracy: n,
    completeness: n,
    sourceQuality: n,
    readability: n,
  });

  it("averages per dimension and overall", () => {
    const agg = aggregateScores([mk(2), mk(4)]);
    expect(agg.perDimension.factualAccuracy).toBe(3);
    expect(agg.overall).toBe(3);
    expect(agg.count).toBe(2);
  });

  it("is all-zero for an empty set", () => {
    const agg = aggregateScores([]);
    expect(agg.overall).toBe(0);
    expect(agg.count).toBe(0);
  });
});

describe("brief metrics", () => {
  it("counts distinct citations and flags placeholders", () => {
    const md =
      "- Claim one [A](https://nih.gov/a)\n- Claim two [B](https://example.com/placeholder)\n- Claim three [A again](https://nih.gov/a)";
    const { urls, placeholders } = citationStats(md);
    expect(urls).toHaveLength(2); // deduped
    expect(placeholders).toHaveLength(1);
  });

  it("computes grounded ratio against bullet count", () => {
    const md = "- a [x](https://nih.gov/a)\n- b [y](https://science.org/b)";
    const m = briefMetrics(md);
    expect(m.bulletCount).toBe(2);
    expect(m.citationCount).toBe(2);
    expect(m.groundedRatio).toBe(1);
    expect(m.placeholderCount).toBe(0);
  });

  it("ratio is 0 with no bullets", () => {
    expect(briefMetrics("plain text, no bullets").groundedRatio).toBe(0);
  });
});
