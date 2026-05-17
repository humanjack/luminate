import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import {
  db,
  projects,
  researchData,
  contentData,
  slides,
  scripts,
  agentRuns,
  agentSteps,
} from "@/lib/db";
import {
  RESEARCH_SYSTEM_PROMPT,
  CONTENT_SYSTEM_PROMPT,
  SCRIPT_SYSTEM_PROMPT,
  getResearchPrompt,
  getContentPrompt,
  getScriptPrompt,
} from "@/lib/llm/prompts";
import { computeCost } from "./cost";
import {
  AGENT_STEPS,
  AgentEvent,
  AgentRunOptions,
  AgentStepName,
  stepsBetween,
} from "./types";

interface CallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

async function callAnthropic(
  client: Anthropic,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  onChunk?: (text: string) => void
): Promise<CallResult> {
  const stream = await client.messages.stream({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text;
      onChunk?.(event.delta.text);
    }
    if (event.type === "message_delta" && event.usage) {
      outputTokens = event.usage.output_tokens;
    }
    if (event.type === "message_start" && event.message.usage) {
      inputTokens = event.message.usage.input_tokens;
    }
  }

  return { text, inputTokens, outputTokens };
}

// Split Slidev markdown into individual slides on `---`
export function splitSlides(markdown: string): string[] {
  return markdown
    .split(/^---\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

interface RunDeps {
  client: Anthropic;
  model: string;
  runId: string;
  projectId: string;
  emit: (event: AgentEvent) => void;
  signal?: AbortSignal;
}

async function runResearchStep(
  deps: RunDeps,
  topic: string,
  depth: "quick" | "detailed" | "comprehensive"
): Promise<CallResult> {
  const userPrompt = getResearchPrompt(topic, depth);
  const result = await callAnthropic(
    deps.client,
    deps.model,
    RESEARCH_SYSTEM_PROMPT,
    userPrompt,
    4096,
    (chunk) =>
      deps.emit({ type: "step_chunk", runId: deps.runId, step: "research", content: chunk })
  );

  const now = new Date();
  const existing = await db
    .select()
    .from(researchData)
    .where(eq(researchData.projectId, deps.projectId));

  if (existing[0]) {
    await db
      .update(researchData)
      .set({ topic, depth, content: result.text, updatedAt: now })
      .where(eq(researchData.id, existing[0].id));
  } else {
    await db.insert(researchData).values({
      id: uuid(),
      projectId: deps.projectId,
      topic,
      depth,
      content: result.text,
      createdAt: now,
      updatedAt: now,
    });
  }
  await db
    .update(projects)
    .set({ currentStep: 2, status: "in_progress", updatedAt: now })
    .where(eq(projects.id, deps.projectId));

  return result;
}

async function runContentStep(
  deps: RunDeps,
  format: "presentation" | "tutorial" | "explainer",
  targetLength: number
): Promise<CallResult> {
  const [research] = await db
    .select()
    .from(researchData)
    .where(eq(researchData.projectId, deps.projectId));

  if (!research?.content) {
    throw new Error("No research content found — run research step first.");
  }

  const userPrompt = getContentPrompt(research.content, format, targetLength);
  const result = await callAnthropic(
    deps.client,
    deps.model,
    CONTENT_SYSTEM_PROMPT,
    userPrompt,
    4096,
    (chunk) =>
      deps.emit({ type: "step_chunk", runId: deps.runId, step: "content", content: chunk })
  );

  const now = new Date();
  const existing = await db
    .select()
    .from(contentData)
    .where(eq(contentData.projectId, deps.projectId));
  const title = research.topic ?? "Untitled video";

  if (existing[0]) {
    await db
      .update(contentData)
      .set({ markdown: result.text, title, format, targetLength, updatedAt: now })
      .where(eq(contentData.id, existing[0].id));
  } else {
    await db.insert(contentData).values({
      id: uuid(),
      projectId: deps.projectId,
      title,
      format,
      targetLength,
      markdown: result.text,
      createdAt: now,
      updatedAt: now,
    });
  }
  await db
    .update(projects)
    .set({ currentStep: 3, updatedAt: now })
    .where(eq(projects.id, deps.projectId));

  return result;
}

async function runSlidesStep(deps: RunDeps): Promise<CallResult> {
  const [content] = await db
    .select()
    .from(contentData)
    .where(eq(contentData.projectId, deps.projectId));

  if (!content?.markdown) {
    throw new Error("No slide content found — run content step first.");
  }

  const parts = splitSlides(content.markdown);
  if (parts.length === 0) {
    throw new Error("Content markdown produced zero slides.");
  }

  const now = new Date();
  await db.delete(slides).where(eq(slides.projectId, deps.projectId));
  const inserted = await Promise.all(
    parts.map((md, index) =>
      db
        .insert(slides)
        .values({
          id: uuid(),
          projectId: deps.projectId,
          index,
          markdown: md,
          theme: "default",
          createdAt: now,
          updatedAt: now,
        })
        .returning()
    )
  );
  await db
    .update(projects)
    .set({ currentStep: 4, updatedAt: now })
    .where(eq(projects.id, deps.projectId));

  const summary = `Parsed ${inserted.length} slides from content markdown.`;
  deps.emit({ type: "step_chunk", runId: deps.runId, step: "slides", content: summary });

  return { text: summary, inputTokens: 0, outputTokens: 0 };
}

async function runScriptsStep(deps: RunDeps): Promise<CallResult> {
  const projectSlides = await db
    .select()
    .from(slides)
    .where(eq(slides.projectId, deps.projectId));
  projectSlides.sort((a, b) => a.index - b.index);

  if (projectSlides.length === 0) {
    throw new Error("No slides found — run slides step first.");
  }

  await db.delete(scripts).where(eq(scripts.projectId, deps.projectId));

  let totalIn = 0;
  let totalOut = 0;
  let fullText = "";
  const now = new Date();

  for (const slide of projectSlides) {
    if (deps.signal?.aborted) {
      throw new Error("Run cancelled by user.");
    }
    deps.emit({
      type: "step_chunk",
      runId: deps.runId,
      step: "scripts",
      content: `\n— Slide ${slide.index + 1} —\n`,
    });
    const userPrompt = getScriptPrompt(slide.markdown, slide.index);
    const result = await callAnthropic(
      deps.client,
      deps.model,
      SCRIPT_SYSTEM_PROMPT,
      userPrompt,
      1024,
      (chunk) =>
        deps.emit({ type: "step_chunk", runId: deps.runId, step: "scripts", content: chunk })
    );

    totalIn += result.inputTokens;
    totalOut += result.outputTokens;
    fullText += result.text + "\n\n";

    const words = result.text.trim().split(/\s+/).length;
    const estimatedDuration = Math.round(words / 2.5); // ~150 wpm

    await db.insert(scripts).values({
      id: uuid(),
      projectId: deps.projectId,
      slideId: slide.id,
      slideIndex: slide.index,
      text: result.text,
      estimatedDuration,
      createdAt: now,
      updatedAt: now,
    });
  }

  await db
    .update(projects)
    .set({ currentStep: 5, updatedAt: now })
    .where(eq(projects.id, deps.projectId));

  return { text: fullText, inputTokens: totalIn, outputTokens: totalOut };
}

const STEP_HANDLERS: Record<
  AgentStepName,
  (deps: RunDeps, opts: AgentRunOptions) => Promise<CallResult>
> = {
  research: (deps, opts) =>
    runResearchStep(
      deps,
      opts.topic ?? "Untitled topic",
      opts.depth ?? "detailed"
    ),
  content: (deps, opts) =>
    runContentStep(deps, opts.format ?? "presentation", opts.targetLength ?? 10),
  slides: (deps) => runSlidesStep(deps),
  scripts: (deps) => runScriptsStep(deps),
};

export async function* runAgent(
  opts: AgentRunOptions,
  signal?: AbortSignal
): AsyncGenerator<AgentEvent> {
  const queue: AgentEvent[] = [];
  // Use a holder object so TS doesn't aggressively narrow the closure-captured value.
  const waiter: { resolve: (() => void) | null } = { resolve: null };

  const emit = (event: AgentEvent) => {
    queue.push(event);
    const r = waiter.resolve;
    waiter.resolve = null;
    if (r) r();
  };

  const client = new Anthropic({ apiKey: opts.apiKey });
  const from = opts.fromStep ?? "research";
  const to = opts.toStep ?? "scripts";
  const steps = stepsBetween(from, to);

  const now = new Date();
  const runId = uuid();
  await db.insert(agentRuns).values({
    id: runId,
    projectId: opts.projectId,
    status: "running",
    fromStep: from,
    toStep: to,
    currentStep: steps[0],
    model: opts.model,
    startedAt: now,
  });

  emit({ type: "run_started", runId });

  // Drain queue and execute steps in background
  let runError: Error | null = null;
  let runDone = false;
  let totalIn = 0;
  let totalOut = 0;
  let totalCost = 0;

  const work = (async () => {
    try {
      const deps: RunDeps = { client, model: opts.model, runId, projectId: opts.projectId, emit, signal };
      for (const step of steps) {
        if (signal?.aborted) throw new Error("Run cancelled");

        const stepRow = {
          id: uuid(),
          runId,
          step,
          status: "running" as const,
          startedAt: new Date(),
        };
        await db.insert(agentSteps).values(stepRow);
        await db
          .update(agentRuns)
          .set({ currentStep: step })
          .where(eq(agentRuns.id, runId));
        emit({ type: "step_started", runId, step });

        const handler = STEP_HANDLERS[step];
        const stepStart = Date.now();
        try {
          const result = await handler(deps, opts);
          const cost = computeCost(opts.model, result.inputTokens, result.outputTokens);
          totalIn += result.inputTokens;
          totalOut += result.outputTokens;
          totalCost += cost;

          await db
            .update(agentSteps)
            .set({
              status: "completed",
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              costUsd: cost,
              durationMs: Date.now() - stepStart,
              completedAt: new Date(),
            })
            .where(eq(agentSteps.id, stepRow.id));

          await db
            .update(agentRuns)
            .set({ inputTokens: totalIn, outputTokens: totalOut, costUsd: totalCost })
            .where(eq(agentRuns.id, runId));

          emit({
            type: "step_completed",
            runId,
            step,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            costUsd: cost,
          });
          emit({
            type: "cost_update",
            runId,
            inputTokens: totalIn,
            outputTokens: totalOut,
            costUsd: totalCost,
          });
        } catch (err) {
          const message = (err as Error).message;
          await db
            .update(agentSteps)
            .set({
              status: "error",
              errorMessage: message,
              durationMs: Date.now() - stepStart,
              completedAt: new Date(),
            })
            .where(eq(agentSteps.id, stepRow.id));
          throw err;
        }
      }

      await db
        .update(agentRuns)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(agentRuns.id, runId));
      emit({ type: "run_completed", runId, costUsd: totalCost });
    } catch (err) {
      runError = err as Error;
      const status = signal?.aborted ? "cancelled" : "error";
      await db
        .update(agentRuns)
        .set({ status, errorMessage: runError.message, completedAt: new Date() })
        .where(eq(agentRuns.id, runId));
      emit({
        type: "run_error",
        runId,
        error: runError.message,
      });
    } finally {
      runDone = true;
      const r = waiter.resolve;
      waiter.resolve = null;
      if (r) r();
    }
  })();

  // Yield events as they arrive
  while (true) {
    while (queue.length > 0) {
      yield queue.shift()!;
    }
    if (runDone && queue.length === 0) break;
    await new Promise<void>((res) => {
      waiter.resolve = res;
    });
  }

  await work; // surface any unexpected promise rejection
}

// Re-export so it's available from `@/lib/agent`
export { AGENT_STEPS } from "./types";
export type { AgentEvent, AgentRunOptions, AgentStepName } from "./types";
