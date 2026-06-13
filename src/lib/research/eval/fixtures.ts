/**
 * Research eval fixtures (Phase 5, #49).
 *
 * A small, representative set of topics — a mix of evergreen (stable facts) and
 * recency-sensitive (needs live search) — used to score research quality and
 * catch regressions. Start small (~12–20 reveals big effects, per Anthropic's
 * eval guidance); grow as needed.
 */
import { ResearchDepth } from "../generate";

export interface ResearchFixture {
  id: string;
  topic: string;
  depth: ResearchDepth;
  kind: "evergreen" | "recency";
  /** What good coverage should touch on (for the judge / manual review). */
  expectations: string[];
}

export const RESEARCH_FIXTURES: ResearchFixture[] = [
  {
    id: "photosynthesis",
    topic: "How photosynthesis works",
    depth: "detailed",
    kind: "evergreen",
    expectations: ["light-dependent reactions", "Calvin cycle", "chlorophyll", "inputs/outputs"],
  },
  {
    id: "compound-interest",
    topic: "Compound interest and why it matters for investing",
    depth: "quick",
    kind: "evergreen",
    expectations: ["formula", "time horizon", "example", "vs simple interest"],
  },
  {
    id: "black-holes",
    topic: "What black holes are and how they form",
    depth: "detailed",
    kind: "evergreen",
    expectations: ["event horizon", "stellar collapse", "singularity", "detection"],
  },
  {
    id: "rust-vs-go",
    topic: "Rust vs Go for backend development",
    depth: "detailed",
    kind: "evergreen",
    expectations: ["memory safety", "concurrency model", "performance", "ecosystem"],
  },
  {
    id: "sleep-health",
    topic: "How sleep affects physical and mental health",
    depth: "detailed",
    kind: "evergreen",
    expectations: ["sleep stages", "circadian rhythm", "deprivation effects", "recommendations"],
  },
  {
    id: "llm-agents",
    topic: "The state of AI agents and agentic workflows in 2026",
    depth: "comprehensive",
    kind: "recency",
    expectations: ["recent models", "tool use", "limitations", "real products"],
  },
  {
    id: "ev-batteries",
    topic: "Latest advances in EV battery technology",
    depth: "comprehensive",
    kind: "recency",
    expectations: ["solid-state", "energy density", "cost trends", "manufacturers"],
  },
  {
    id: "quantum-computing",
    topic: "Quantum computing progress and milestones",
    depth: "comprehensive",
    kind: "recency",
    expectations: ["qubits", "error correction", "recent results", "use cases"],
  },
  {
    id: "mediterranean-diet",
    topic: "The Mediterranean diet and its health benefits",
    depth: "detailed",
    kind: "evergreen",
    expectations: ["components", "studies", "cardiovascular benefits", "criticisms"],
  },
  {
    id: "climate-tipping-points",
    topic: "Climate tipping points and what they mean",
    depth: "comprehensive",
    kind: "recency",
    expectations: ["examples", "thresholds", "feedback loops", "current science"],
  },
  {
    id: "git-internals",
    topic: "How Git works under the hood",
    depth: "detailed",
    kind: "evergreen",
    expectations: ["objects", "commits/trees/blobs", "refs", "the index"],
  },
  {
    id: "intermittent-fasting",
    topic: "Intermittent fasting: evidence and methods",
    depth: "quick",
    kind: "evergreen",
    expectations: ["common protocols", "evidence", "risks", "who should avoid"],
  },
];
