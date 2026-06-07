/**
 * Research eval runner (Phase 5, #49).
 *
 * Generates research for each fixture with the real agentic pipeline, computes
 * cheap metrics + an LLM-as-judge rubric score, aggregates, and writes a report
 * to evals/research/out/. Gated on ANTHROPIC_API_KEY (skipped otherwise), so it
 * never runs in normal CI — invoke explicitly with `make eval-research`.
 *
 * Lives outside src/** so the default vitest run doesn't pick it up.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import { generateAgenticResearch } from "@/lib/research/loop";
import { type ResearchGenerationConfig } from "@/lib/research/generate";
import { RESEARCH_FIXTURES } from "@/lib/research/eval/fixtures";
import { briefMetrics } from "@/lib/research/eval/metrics";
import {
  aggregateScores,
  buildJudgePrompt,
  parseRubricScores,
  type RubricScores,
} from "@/lib/research/eval/rubric";

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.EVAL_MODEL || "claude-sonnet-4-6";
const OUT_DIR = path.resolve(process.cwd(), "evals/research/out");
// Soft floor; only enforced when EVAL_STRICT=1 so the report is the default output.
const GROUNDED_FLOOR = Number(process.env.EVAL_GROUNDED_FLOOR || "0.3");

interface Row {
  id: string;
  topic: string;
  sources: number;
  metrics: ReturnType<typeof briefMetrics>;
  scores: RubricScores | null;
}

async function generate(cfg: ResearchGenerationConfig, topic: string, depth: ResearchFixtureDepth) {
  let content = "";
  let sources = 0;
  for await (const ev of generateAgenticResearch(cfg, topic, depth)) {
    if (ev.type === "text") content += ev.content;
    else if (ev.type === "sources") sources = ev.sources.length;
    else if (ev.type === "error") throw new Error(ev.content);
  }
  return { content, sources };
}

type ResearchFixtureDepth = (typeof RESEARCH_FIXTURES)[number]["depth"];

describe.skipIf(!API_KEY)("research eval harness", () => {
  it(
    "runs the fixture suite and writes a report",
    async () => {
      const client = new Anthropic({ apiKey: API_KEY });
      const cfg: ResearchGenerationConfig = {
        enableWebResearch: true,
        searchProvider: "anthropic",
        maxSources: 10,
        maxSearchIterations: 2,
        anthropicApiKey: API_KEY,
        model: MODEL,
      };

      const rows: Row[] = [];
      for (const fx of RESEARCH_FIXTURES) {
        try {
          const { content, sources } = await generate(cfg, fx.topic, fx.depth);
          const judge = await client.messages.create({
            model: MODEL,
            max_tokens: 512,
            messages: [{ role: "user", content: buildJudgePrompt(fx.topic, content) }],
          });
          const judgeText = judge.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("\n");
          rows.push({
            id: fx.id,
            topic: fx.topic,
            sources,
            metrics: briefMetrics(content),
            scores: parseRubricScores(judgeText),
          });
        } catch (err) {
          rows.push({
            id: fx.id,
            topic: fx.topic,
            sources: 0,
            metrics: { citationCount: 0, placeholderCount: 0, groundedRatio: 0, bulletCount: 0 },
            scores: null,
          });
          // eslint-disable-next-line no-console
          console.error(`[eval] ${fx.id} failed:`, (err as Error).message);
        }
      }

      const aggregate = aggregateScores(rows.map((r) => r.scores).filter(Boolean) as RubricScores[]);
      const avgGrounded =
        rows.reduce((a, r) => a + r.metrics.groundedRatio, 0) / Math.max(1, rows.length);
      const totalPlaceholders = rows.reduce((a, r) => a + r.metrics.placeholderCount, 0);

      mkdirSync(OUT_DIR, { recursive: true });
      const report = { model: MODEL, aggregate, avgGrounded, totalPlaceholders, rows };
      writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
      writeFileSync(path.join(OUT_DIR, "report.md"), renderMarkdown(report));

      // eslint-disable-next-line no-console
      console.log(
        `[eval] overall ${aggregate.overall.toFixed(2)}/5, grounded ${(avgGrounded * 100).toFixed(0)}%, placeholders ${totalPlaceholders}`,
      );

      // Placeholder URLs are always a hard failure — that's the whole point of Phase 1.
      expect(totalPlaceholders).toBe(0);
      if (process.env.EVAL_STRICT === "1") {
        expect(avgGrounded).toBeGreaterThanOrEqual(GROUNDED_FLOOR);
      }
    },
    20 * 60 * 1000, // up to 20 min for the full suite
  );
});

function renderMarkdown(report: {
  model: string;
  aggregate: ReturnType<typeof aggregateScores>;
  avgGrounded: number;
  totalPlaceholders: number;
  rows: Row[];
}): string {
  const dims = Object.entries(report.aggregate.perDimension)
    .map(([k, v]) => `- ${k}: ${v.toFixed(2)}/5`)
    .join("\n");
  const table = report.rows
    .map(
      (r) =>
        `| ${r.id} | ${r.sources} | ${r.metrics.citationCount} | ${(r.metrics.groundedRatio * 100).toFixed(0)}% | ${
          r.scores ? "ok" : "—"
        } |`,
    )
    .join("\n");
  return `# Research eval report

**Model:** ${report.model}
**Overall:** ${report.aggregate.overall.toFixed(2)}/5 (n=${report.aggregate.count})
**Avg grounded ratio:** ${(report.avgGrounded * 100).toFixed(0)}%
**Placeholder URLs:** ${report.totalPlaceholders}

## Per-dimension
${dims}

## Per-fixture
| fixture | sources | citations | grounded | judged |
|---|---|---|---|---|
${table}
`;
}
