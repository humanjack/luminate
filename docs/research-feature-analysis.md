# Research Feature: Current State, World-Class Benchmark, and Improvement Plan

> **Status:** Analysis & proposal · **Date:** 2026-06-06 · **Scope:** Step 1 (Research) of the 7-step workflow
>
> This document (1) describes exactly how the Research step works today, (2) summarizes how world-class "deep research" features are built in 2025–2026 products, (3) compares the two, and (4) lays out a phased plan to close the gap.

---

## 1. How Research works today

The Research step is step 1 of the Luminate pipeline (Research → Content → Slides → Script → Recording → Analysis → Video). A user enters a **topic** and picks a **depth** (Quick / Detailed / Comprehensive), clicks **Generate**, and the app streams back a markdown research brief that seeds the rest of the pipeline.

### 1.1 End-to-end flow (the user-facing "Generate" path)

```
ResearchPage (research/page.tsx)
  └─ useLLM().streamResearch(topic, depth)        src/hooks/useLLM.ts
       └─ POST /api/llm/research                  src/app/api/llm/research/route.ts
            └─ proxies to FastAPI: BACKEND_URL/api/llm/research   (default http://localhost:8000)
                 └─ single LLM call via LangChain (Anthropic/OpenAI/Google)
                      └─ SSE stream of {type:"text"} chunks back to the page
  └─ on "done": saveResearchData() + extract sources + extract claims
       ├─ POST /api/projects/[id]/research        (upserts research_data, sets currentStep = 2)
       └─ POST /api/projects/[id]/claims          (seeds claims table)
```

Key fact: **the user-facing Generate button does not run any LLM logic inside Next.js.** [`/api/llm/research`](../src/app/api/llm/research/route.ts) is a thin proxy that forwards `{topic, depth}` to the FastAPI backend and pipes the stream straight back. The backend owns the prompt and the provider call. This contradicts [`docs/runtime-boundary.md`](runtime-boundary.md) (which declares Next.js canonical and FastAPI frozen) — the manual research path depends on the backend being up at `localhost:8000`.

### 1.2 The prompt (this is the whole "research engine")

The actual instruction sent to the model is identical in the TS copy ([`src/lib/llm/prompts.ts`](../src/lib/llm/prompts.ts)) and the Python copy ([`backend/app/llm/prompts.py`](../backend/app/llm/prompts.py)):

**System prompt:**
```
You are a research assistant specializing in creating educational content for YouTube videos.
Your task is to research topics thoroughly and present information in a clear, engaging way.
Always cite sources when possible and provide factual, accurate information.
Format your response in markdown with clear headings and bullet points.
Include a "Key Points" section at the beginning and a "Sources" section at the end.
```

**User prompt:**
```
Research the following topic for a YouTube video: "${topic}"

${depthInstructions[depth]}

Structure your research as follows:
1. **Key Points** - A bulleted summary of the main takeaways
2. **Introduction** - Brief context and why this topic matters
3. **Main Content** - Detailed exploration of the topic with relevant facts and insights
4. **Practical Applications** - How viewers can apply this knowledge
5. **Sources** - List any referenced materials (use placeholder URLs if needed)

Make the content engaging and suitable for video narration.
```

Depth only changes a word budget:
- **Quick** → 300–500 words
- **Detailed** → 800–1200 words (default)
- **Comprehensive** → 1500–2500 words

> **This is a single, one-shot LLM completion.** There is no web search, no tool use, no iteration, no retrieval. The model answers entirely from its training-cutoff parametric memory. Line 36 literally instructs the model to **"use placeholder URLs if needed"** — i.e. the citations it produces are invented text, not real sources.

### 1.3 Data model

[`research_data`](../src/lib/db/schema.ts) (one-to-one per project):

```ts
research_data {
  id, projectId,
  topic,
  depth: "quick" | "detailed" | "comprehensive",   // default "detailed"
  content,                                          // generated markdown
  sources: json<{title, url, snippet?}[]>,          // denormalized blob
  createdAt, updatedAt
}
```

There is **also** a richer first-class sources/claims system (from issue #4) that lives alongside the research blob:

- **`sources`** table — `type: url|text|manual`, `status: pending|fetched|approved|rejected|failed`, plus `fetchedText`, `trustNotes`.
- **`claims`** table — `text`, `sourceIds: string[]`, `pinned`, `status: proposed|approved|rejected`.

This is surfaced in [`sources-panel.tsx`](../src/components/workflow/sources-panel.tsx) and flags **unsupported claims** (claims with no `sourceIds`).

### 1.4 How "sources" and "claims" actually get populated

1. **Prompt-fabricated** — the model writes a "Sources" section, placeholder URLs allowed.
2. **Regex-scraped** — `extractSources()` in [`research/page.tsx`](../src/app/(workspace)/projects/[id]/research/page.tsx) pulls `[title](url)` markdown links out of the generated text into `research_data.sources`.
3. **Manually added by the user** — in the Sources panel, a user can paste a URL or text. For a URL, [`/api/projects/[id]/sources`](../src/app/api/projects/[id]/sources/route.ts) does a **one-time server-side `fetch()`** of that single URL (10s timeout, HTML stripped, up to 200k chars stored as `fetchedText`).
4. **Claim extraction** — `extractClaimsFromMarkdown()` ([`src/lib/research/claims.ts`](../src/lib/research/claims.ts)) treats each top-level bullet as a claim and resolves inline link URLs to known source IDs; bullets with no link become unsupported claims.

> The manual single-URL fetch (#3) is the **only** time the system touches the live web — and it is user-initiated, not autonomous. The model never sees those fetched sources during generation; sources are reconciled *after* the text already exists.

### 1.5 Secondary / dead paths (for completeness)

- **Agent/autopilot path** — [`src/lib/agent/runner.ts`](../src/lib/agent/runner.ts) `runResearchStep()` calls the Anthropic SDK in-process using the TS prompts (`max_tokens: 4096`). Same single-shot prompt, no tools.
- **Orphaned clients** — [`anthropic-client.ts`](../src/lib/llm/anthropic-client.ts) and [`claude-cli.ts`](../src/lib/llm/claude-cli.ts) each have a `streamResearch`, but nothing on the active path imports them (tests only).

### 1.6 Honest summary of today

| Dimension | Today |
|---|---|
| Retrieval | **None.** Parametric memory only. |
| Recency | Frozen at model training cutoff. |
| Tools | None. |
| Iteration | Single shot, no reflection/follow-up. |
| Citations | **Fabricated** (placeholder URLs allowed). |
| Source grounding | Post-hoc regex + optional manual URL fetch. |
| Quality control | None (no eval, no verification). |
| Depth control | Word-count instruction only. |
| Cost/latency | Cheap, fast (one call). |
| Failure mode | Confident, fluent, **unverifiable, possibly hallucinated** content that seeds the entire downstream video. |

The core risk: **every downstream step (content, slides, script, the final video) inherits whatever the model invented in step 1**, with no grounding in real sources.

---

## 2. How world-class AI research is done in products (2025–2026)

The defining shift in the last two years: **research is an agentic loop or multi-agent orchestration — plan → search → read → reflect → iterate — not a single prompt.** Frontier models are increasingly *trained* (via RL) to decide *when* to search, browse, and run code.

### 2.1 Leading products

- **OpenAI Deep Research (ChatGPT)** — a version of **o3 trained end-to-end with RL** on real browsing+reasoning tasks. Clarifies intent → decomposes → iterative web search with query refinement → reads HTML/PDF/images, runs code → synthesizes an inline-cited report. ~5–30 min/task. **26.6% on Humanity's Last Exam** (vs. low single digits for non-agentic models); SOTA on GAIA at launch. Known issue: o3 makes more claims overall → more accurate *and* more hallucinated claims. [intro](https://openai.com/index/introducing-deep-research/) · [system card](https://cdn.openai.com/deep-research-system-card.pdf)

- **Google Gemini Deep Research** — generates an **editable research plan shown to the user before execution**; planner decides which sub-tasks run in parallel vs. sequentially; loops search→browse→"what do I know / what's unclear"→follow-up "dozens of times." Backed by a **novel async task manager** (resilient to errors, you can close your laptop mid-run), 1M-token context + RAG, multi-pass self-critique during synthesis. [overview](https://gemini.google/overview/deep-research/)

- **Anthropic Claude Research** — **orchestrator-worker multi-agent** system (see §2.3). Independent (DRBench) testing put "Claude with search" highest on **citation accuracy (94%)** vs. OpenAI Deep Research (78%). [engineering post](https://www.anthropic.com/engineering/multi-agent-research-system)

- **Perplexity Deep Research** — autonomous loop that "iteratively searches, reads documents, and reasons about what to do next, refining its plan as it learns." Dozens of searches, hundreds of sources, usually **< 3 min**. **21.1% HLE, 93.9% SimpleQA**. [blog](https://www.perplexity.ai/hub/blog/introducing-perplexity-deep-research)

### 2.2 The architectural patterns (this is the comparison checklist)

1. **Agentic search loop** — the LLM evaluates its own intermediate results and decides whether to keep going. ("Agentic RAG" — dynamic retrieval as a control loop, vs. classic RAG's fixed pipeline.)
2. **Query decomposition** — break the topic into sub-questions before searching.
3. **Live web retrieval** — search APIs (fast, scalable) + browser/fetch (dynamic, multimodal). Best systems combine both.
4. **Source gathering / ranking / dedup** — evaluate credibility, dedupe URLs, **prefer primary over secondary** sources.
5. **Reflection / gap analysis** — "identify what I know, what's unclear, plan follow-up searches"; multiple self-critique passes.
6. **Iterative deepening** — re-query on weak coverage instead of forcing an answer.
7. **Parallelism** — multiple searches at once; often multiple subagents (the dominant latency/breadth lever).
8. **Separate citation-grounding pass** — a dedicated step that ties each claim to a real source *after* drafting, rather than trusting inline citations the generator emitted.
9. **Tool use** — code interpreter, data tools, multimodal, computer use, as needed.
10. **Structured output** — explicit plan object, report with descriptive headings + clickable inline citations.

### 2.3 Anthropic's multi-agent research system — the key lessons

Source: [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system).

- **Orchestrator-worker:** a lead agent (Opus) plans, saves the plan to memory, and spawns **3–5 subagents (Sonnet)** that search in parallel and report findings back. A separate **CitationAgent** attributes every claim at the end.
- **Two levels of parallelism** (lead spawns subagents in parallel; each subagent calls 3+ tools in parallel) → up to **90% less research time** on complex queries.
- **Token economics:** agents use ~4× chat tokens; multi-agent ~15×. On BrowseComp, **token usage alone explained 80% of performance variance** — you're largely "buying parallelism with tokens." Multi-agent only pays off when task value is high and the task decomposes into independent threads.
- **Result:** multi-agent **beat single-agent Opus by 90.2%** on their internal research eval.
- **Prompt engineering:** scale effort to complexity (embed rules so the agent doesn't spawn 50 subagents for a trivial query); start wide then narrow; use extended thinking as a controllable scratchpad; give each subagent a crisp objective + output format + boundaries.
- **Evaluation:** LLM-as-judge rubric (factual accuracy, citation accuracy, completeness, source quality, tool efficiency); **start small (~20 queries)**; for stateful agents evaluate the *end state*, not the exact path; humans still catch edge cases evals miss.

### 2.4 Quality & evaluation (and the big caveat)

- **Benchmarks:** DeepResearch Bench (RACE report-quality + FACT citation-trust), BrowseComp / BrowseComp-Plus, with **LLM-as-judge** as the standard scoring method.
- **Citation accuracy is the weak spot even at the frontier:** link validity can be >94% and relevance >80% while **factual accuracy is only 39–77%**; **11–57% of citations in commercial models contain hallucinations/misattributions.**
- **Counterintuitive:** fact-checking accuracy can **drop ~42% as tool calls scale from 2 → 150** ("information overload impairs synthesis"). So **unbounded looping is itself a failure mode** — bound it.

Sources: [survey/taxonomy](https://arxiv.org/html/2506.18096v2) · [Agentic RAG survey](https://arxiv.org/html/2501.09136v3) · [DeepResearch Bench](https://arxiv.org/pdf/2506.11763) · [citation reliability](https://arxiv.org/html/2605.06635v1)

---

## 3. Side-by-side comparison

| Capability | World-class deep research | Luminate today | Gap |
|---|---|---|---|
| **Live retrieval** | Search APIs + browsing, every run | None (parametric memory) | 🔴 Critical |
| **Recency** | Real-time web | Training cutoff | 🔴 Critical |
| **Real citations** | Grounded, verified, clickable | Placeholder/fabricated URLs | 🔴 Critical |
| **Query decomposition** | Sub-questions before searching | None | 🟠 High |
| **Agentic loop / iteration** | plan→search→read→reflect→repeat | Single shot | 🟠 High |
| **Reflection / gap analysis** | Multi-pass self-critique | None | 🟠 High |
| **Source ranking & dedup** | Credibility-ranked, primary-preferred | Regex scrape of generated links | 🟠 High |
| **Citation-grounding pass** | Dedicated post-hoc verification | None | 🟠 High |
| **Parallelism / subagents** | 3–5 subagents, parallel tools | Single call | 🟡 Medium |
| **Evaluation** | Rubric + LLM-as-judge | None | 🟡 Medium |
| **Structured plan/output** | Editable plan object | Free-form markdown | 🟡 Medium |
| **Depth control** | Effort scales tools/subagents | Word count only | 🟡 Medium |
| **User steering** | Editable plan, clarifying Qs | Topic + depth dropdown | 🟢 Low |
| **Cost / latency** | High (~15× tokens), minutes | Very low, seconds | (today's only advantage) |

**One-line verdict:** Luminate's "research" is a well-formatted single LLM completion with invented citations. World-class research is a grounded, iterative, tool-using agent with a separate verification pass. The single highest-leverage change is **adding real web search + a citation-grounding step** so the rest of the pipeline is built on verifiable facts.

The good news: the codebase already has the right *substrate* — first-class `sources` and `claims` tables, an unsupported-claim flag, a server-side URL fetcher, and a claim-extraction utility. These were built for grounding; today they're populated *after the fact*. The plan below wires them *into* generation.

---

## 4. Improvement plan

Phased so each step ships value independently. Effort is rough (S/M/L). The guiding principle: **make claims grounded in real, fetched sources before they reach the user — and bound the loop** (recall §2.4: more searching ≠ better past a point).

### Phase 0 — Decide the runtime & pick a search provider (S, prerequisite)

- **Resolve the proxy/runtime split.** Per [`docs/runtime-boundary.md`](runtime-boundary.md), Next.js is canonical. Move research generation into a Next.js route (reuse the in-process Anthropic path in [`runner.ts`](../src/lib/agent/runner.ts)) so the feature doesn't silently depend on a "frozen" FastAPI backend at `localhost:8000`. *Or* explicitly bless the backend as the research runtime and update the doc. **Don't leave it ambiguous.**
- **Choose a retrieval provider.** Options: native **Anthropic web search / web fetch tool** (simplest — tool use baked into the model), or a search API (Tavily / Brave / Exa / SerpAPI) + the existing URL fetcher. Recommendation: start with the model's **native web search tool** for the lowest-integration grounded path, since the app already centers on Anthropic.
- Add settings: `enableWebResearch` (toggle), `searchProvider`, optional API key, `maxSources`, `maxSearchIterations` (the bound).

### Phase 1 — Grounded single-pass research (M) ⭐ highest leverage

Goal: research that cites **real, fetched** sources instead of placeholders. No full agent yet.

1. Give the research call a **web search tool** (native tool use or "search API → fetch top N → stuff into context").
2. Rewrite the prompt: **remove "use placeholder URLs if needed"** entirely; require every Sources entry to be a real URL the model actually retrieved; require inline citations next to claims.
3. Persist retrieved pages into the existing `sources` table (`type: url`, `status: fetched`) **at generation time**, and link extracted `claims` to those real `sourceIds` via the existing [`claims.ts`](../src/lib/research/claims.ts) flow.
4. Surface "X sources gathered" + the unsupported-claims count in the UI (panel already supports it).

*Outcome:* the regex/claims/sources machinery that exists today gets fed real data, and downstream steps inherit verifiable facts.

### Phase 2 — Agentic loop: decompose → search → reflect → iterate (L)

Turn the single pass into a bounded loop:

1. **Plan step** — model decomposes the topic into 4–8 sub-questions (structured output) using extended thinking. Optionally show the plan to the user to edit (Gemini-style) — fits the existing depth UI.
2. **Search step** — run searches per sub-question, **in parallel**, dedupe URLs, rank by credibility (prefer primary sources).
3. **Reflect step** — "what's answered, what's thin?" → at most `maxSearchIterations` follow-up rounds (default 2–3; **bound it** per §2.4).
4. **Synthesize** — write the brief from gathered sources with inline citations.
5. Stream phase labels ("Planning…", "Searching 6 sub-questions…", "Synthesizing…") to `LLMProgressPanel`.

Depth now maps to **effort** (sub-question count, iterations, source budget), not just word count.

### Phase 3 — Citation-grounding / verification pass (M) ⭐ quality multiplier

After drafting, run a dedicated **CitationAgent-style pass** (Anthropic's biggest citation-accuracy lever):

1. For each claim, verify it's actually supported by the cited `fetchedText`; downgrade unsupported claims to `status: proposed`/unsupported.
2. Flag claims with no real source; offer "search for a source" or "remove."
3. Show a research **trust summary**: N claims, M grounded, K unsupported. Gate "Continue to Content" on a configurable threshold.

This directly attacks the field's known weak spot (39–77% factual accuracy even with valid links).

### Phase 4 — Multi-agent / parallel subagents (L, optional)

Only if Comprehensive depth needs it and the cost is justified (recall ~15× tokens):

- Lead agent plans → spawns subagents per sub-question (this codebase can use the **Workflow** tool / `Agent` subagents) → each returns findings + sources → lead synthesizes → CitationAgent grounds.
- Embed **scale-to-complexity** rules so Quick stays 1 call and only Comprehensive fans out.

### Phase 5 — Evaluation harness (M, ongoing)

- Build ~20 representative research topics as a fixture set.
- **LLM-as-judge** rubric: factual accuracy, citation accuracy, completeness, source quality, readability.
- Track grounded-claim ratio and unsupported-claim count as regression metrics in CI. Evaluate the **end state**, not the path.

### Suggested sequencing

```
Phase 0 (decide runtime + provider)        ← do first, small
   └─ Phase 1 (grounded single-pass)       ← ship this; 80% of the value
        ├─ Phase 3 (citation grounding)    ← pairs with Phase 1, big quality win
        └─ Phase 2 (agentic loop)          ← depth/quality
             └─ Phase 4 (multi-agent)      ← only if justified
   └─ Phase 5 (eval harness)               ← start alongside Phase 1, run continuously
```

**If you do only one thing:** Phase 1 + Phase 3 — real web search at generation time plus a citation-verification pass. That alone moves Luminate from "fluent guesses with fake links" to "grounded, verifiable research," and everything downstream improves for free.

---

## Appendix: key files

| Concern | File |
|---|---|
| Research UI page | [`src/app/(workspace)/projects/[id]/research/page.tsx`](../src/app/(workspace)/projects/[id]/research/page.tsx) |
| LLM stream route (FastAPI proxy) | [`src/app/api/llm/research/route.ts`](../src/app/api/llm/research/route.ts) |
| Research persistence route | [`src/app/api/projects/[id]/research/route.ts`](../src/app/api/projects/[id]/research/route.ts) |
| Prompts (TS) | [`src/lib/llm/prompts.ts`](../src/lib/llm/prompts.ts) |
| Prompts (Python, active path) | [`backend/app/llm/prompts.py`](../backend/app/llm/prompts.py) |
| `useLLM` hook | [`src/hooks/useLLM.ts`](../src/hooks/useLLM.ts) |
| Schema (`research_data`, `sources`, `claims`) | [`src/lib/db/schema.ts`](../src/lib/db/schema.ts) |
| Project store | [`src/stores/project-store.ts`](../src/stores/project-store.ts) |
| Sources panel UI | [`src/components/workflow/sources-panel.tsx`](../src/components/workflow/sources-panel.tsx) |
| Sources API (single-URL fetch) | [`src/app/api/projects/[id]/sources/route.ts`](../src/app/api/projects/[id]/sources/route.ts) |
| Claims API | [`src/app/api/projects/[id]/claims/route.ts`](../src/app/api/projects/[id]/claims/route.ts) |
| Claim extraction util | [`src/lib/research/claims.ts`](../src/lib/research/claims.ts) |
| Agent runner research step | [`src/lib/agent/runner.ts`](../src/lib/agent/runner.ts) |
| Runtime boundary doc | [`docs/runtime-boundary.md`](runtime-boundary.md) |
