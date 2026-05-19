export const AGENT_STEPS = [
  "research",
  "content",
  "slides",
  "scripts",
] as const;

export type AgentStepName = (typeof AGENT_STEPS)[number];

export type AgentRunStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "error"
  | "cancelled";

export type AgentStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "error"
  | "skipped";

export interface AgentEvent {
  type:
    | "run_started"
    | "step_started"
    | "step_chunk"
    | "step_completed"
    | "step_error"
    | "run_completed"
    | "run_error"
    | "cost_update";
  runId: string;
  step?: AgentStepName;
  content?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  error?: string;
}

export interface AgentRunOptions {
  projectId: string;
  apiKey: string;
  model: string;
  topic?: string;
  depth?: "quick" | "detailed" | "comprehensive";
  format?: "presentation" | "tutorial" | "explainer";
  targetLength?: number;
  fromStep?: AgentStepName;
  toStep?: AgentStepName;
}

export function stepIndex(step: AgentStepName): number {
  return AGENT_STEPS.indexOf(step);
}

export function nextStep(step: AgentStepName): AgentStepName | null {
  const i = stepIndex(step);
  if (i < 0 || i >= AGENT_STEPS.length - 1) return null;
  return AGENT_STEPS[i + 1];
}

export function stepsBetween(
  from: AgentStepName,
  to: AgentStepName
): AgentStepName[] {
  const start = stepIndex(from);
  const end = stepIndex(to);
  if (start < 0 || end < 0 || end < start) return [];
  return AGENT_STEPS.slice(start, end + 1);
}
