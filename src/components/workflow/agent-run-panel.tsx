"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  CircleCheckBig,
  CircleX,
  Loader2,
  Play,
  Square,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectStore } from "@/stores/project-store";
import { useSettingsStore } from "@/stores/settings-store";
import { formatCost } from "@/lib/agent/cost";
import {
  AGENT_STEPS,
  type AgentEvent,
  type AgentStepName,
} from "@/lib/agent/types";

const STEP_LABELS: Record<AgentStepName, string> = {
  research: "Research",
  content: "Slide content",
  slides: "Split into slides",
  scripts: "Per-slide scripts",
};

type StepState = "pending" | "running" | "completed" | "error";

interface StepView {
  step: AgentStepName;
  state: StepState;
  preview: string;
}

interface AgentRunPanelProps {
  projectId: string;
}

export function AgentRunPanel({ projectId }: AgentRunPanelProps) {
  const { currentProject, loadProject } = useProjectStore();
  const { llmProvider, anthropicApiKey, claudeModel, hasValidLLMConfig } =
    useSettingsStore();

  const [collapsed, setCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [running, setRunning] = useState(false);
  const [topic, setTopic] = useState("");
  const [depth, setDepth] = useState<"quick" | "detailed" | "comprehensive">(
    "detailed"
  );
  const [format, setFormat] = useState<"presentation" | "tutorial" | "explainer">(
    "presentation"
  );
  const [targetLength, setTargetLength] = useState(5);
  const [steps, setSteps] = useState<StepView[]>([]);
  const [costUsd, setCostUsd] = useState(0);
  const [tokensIn, setTokensIn] = useState(0);
  const [tokensOut, setTokensOut] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentProject?.researchData?.topic && !topic) {
      setTopic(currentProject.researchData.topic);
    }
    if (currentProject?.researchData?.depth) {
      setDepth(currentProject.researchData.depth);
    }
    if (currentProject?.contentData?.format) {
      setFormat(currentProject.contentData.format);
    }
    if (currentProject?.contentData?.targetLength) {
      setTargetLength(currentProject.contentData.targetLength);
    }
  }, [currentProject, topic]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  }, []);

  const startSteps = useMemo<StepView[]>(
    () => AGENT_STEPS.map((s) => ({ step: s, state: "pending" as StepState, preview: "" })),
    []
  );

  const isAnthropic = llmProvider === "anthropic";
  const canRun = isAnthropic && hasValidLLMConfig() && topic.trim().length > 0;

  const run = useCallback(async () => {
    if (!canRun) {
      setError(
        isAnthropic
          ? "Please configure your Anthropic API key in Settings, then enter a topic."
          : "The agent currently runs against Anthropic only — switch your provider in Settings."
      );
      return;
    }
    setError(null);
    setCompleted(false);
    setRunning(true);
    setSteps(startSteps);
    setCostUsd(0);
    setTokensIn(0);
    setTokensOut(0);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          apiKey: anthropicApiKey,
          model: claudeModel,
          topic: topic.trim(),
          depth,
          format,
          targetLength,
          fromStep: "research",
          toStep: "scripts",
        }),
        signal: abort.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Agent request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const event = JSON.parse(payload) as AgentEvent;
            handleEvent(event);
          } catch {
            // ignore malformed payload
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
      // Refresh project so the rest of the UI sees the new data
      loadProject(projectId);
    }
  }, [
    canRun,
    isAnthropic,
    projectId,
    anthropicApiKey,
    claudeModel,
    topic,
    depth,
    format,
    targetLength,
    startSteps,
    loadProject,
  ]);

  const handleEvent = useCallback((event: AgentEvent) => {
    setSteps((prev) => {
      if (event.type === "step_started" && event.step) {
        return prev.map((s) =>
          s.step === event.step ? { ...s, state: "running", preview: "" } : s
        );
      }
      if (event.type === "step_chunk" && event.step && event.content) {
        return prev.map((s) =>
          s.step === event.step
            ? { ...s, preview: (s.preview + event.content).slice(-280) }
            : s
        );
      }
      if (event.type === "step_completed" && event.step) {
        return prev.map((s) =>
          s.step === event.step ? { ...s, state: "completed" } : s
        );
      }
      return prev;
    });

    if (event.type === "cost_update") {
      if (typeof event.costUsd === "number") setCostUsd(event.costUsd);
      if (typeof event.inputTokens === "number") setTokensIn(event.inputTokens);
      if (typeof event.outputTokens === "number") setTokensOut(event.outputTokens);
    }

    if (event.type === "run_completed") {
      setCompleted(true);
    }

    if (event.type === "run_error" && event.error) {
      setError(event.error);
    }

    // Auto-scroll to latest activity
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }, []);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        data-testid="agent-panel-toggle"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-indigo-600 text-white px-4 py-2 shadow-lg hover:bg-indigo-500 transition"
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">Run with AI</span>
      </button>
    );
  }

  return (
    <div
      data-testid="agent-panel"
      className="fixed bottom-4 right-4 z-50 w-[380px] max-h-[85vh] flex flex-col rounded-xl border bg-background shadow-2xl"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
            <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="font-semibold text-sm">AI Pipeline</div>
            <div className="text-xs text-muted-foreground">
              Research → Content → Slides → Scripts
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Toggle settings"
          >
            {showSettings ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(true)}
            aria-label="Minimize agent panel"
          >
            <Square className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-y-auto" ref={scrollRef}>
        {(showSettings || !running) && (
          <div className="p-4 space-y-3 border-b">
            <div>
              <Label htmlFor="agent-topic" className="text-xs">
                Topic
              </Label>
              <Input
                id="agent-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. The economics of solar energy"
                disabled={running}
                className="h-8"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Depth</Label>
                <Select
                  value={depth}
                  onValueChange={(v) =>
                    setDepth(v as "quick" | "detailed" | "comprehensive")
                  }
                  disabled={running}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quick">Quick</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                    <SelectItem value="comprehensive">Comprehensive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Format</Label>
                <Select
                  value={format}
                  onValueChange={(v) =>
                    setFormat(v as "presentation" | "tutorial" | "explainer")
                  }
                  disabled={running}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presentation">Presentation</SelectItem>
                    <SelectItem value="tutorial">Tutorial</SelectItem>
                    <SelectItem value="explainer">Explainer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Target length (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={targetLength}
                onChange={(e) =>
                  setTargetLength(Math.max(1, Number(e.target.value) || 1))
                }
                disabled={running}
                className="h-8"
              />
            </div>
          </div>
        )}

        <div className="p-4 space-y-2">
          {(steps.length === 0 ? startSteps : steps).map((s, i) => (
            <StepRow key={s.step} index={i} step={s} />
          ))}
        </div>

        {(costUsd > 0 || tokensIn > 0 || tokensOut > 0) && (
          <div className="px-4 py-3 border-t bg-muted/40">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Cost so far</span>
              <span className="font-mono font-medium">{formatCost(costUsd)}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-muted-foreground">Tokens</span>
              <span className="font-mono text-xs">
                {tokensIn.toLocaleString()} in / {tokensOut.toLocaleString()} out
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="px-4 py-3 border-t bg-destructive/10 text-destructive text-xs">
            {error}
          </div>
        )}

        {completed && !error && (
          <div className="px-4 py-3 border-t bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CircleCheckBig className="w-4 h-4" />
            Pipeline finished. Open the Recording step to continue.
          </div>
        )}
      </div>

      <div className="p-3 border-t flex gap-2">
        {!running ? (
          <Button
            onClick={run}
            disabled={!canRun}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500"
          >
            <Play className="w-4 h-4 mr-2" />
            Run with AI
          </Button>
        ) : (
          <Button onClick={cancel} variant="destructive" className="flex-1">
            <Square className="w-4 h-4 mr-2" />
            Cancel run
          </Button>
        )}
      </div>
    </div>
  );
}

function StepRow({ index, step }: { index: number; step: StepView }) {
  return (
    <div
      data-testid={`agent-step-${step.step}`}
      className="rounded-lg border p-2 bg-card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StepIcon state={step.state} />
          <div className="text-sm font-medium">
            {index + 1}. {STEP_LABELS[step.step]}
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {step.state}
        </div>
      </div>
      {step.preview && (
        <div className="mt-1 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap font-mono">
          {step.preview}
        </div>
      )}
    </div>
  );
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "running") return <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />;
  if (state === "completed") return <CircleCheckBig className="w-4 h-4 text-emerald-500" />;
  if (state === "error") return <CircleX className="w-4 h-4 text-destructive" />;
  return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/40" />;
}
