"use client";

import { useState, useEffect, use } from "react";
import { Sparkles, AlertCircle, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { StepContainer } from "@/components/workflow/step-container";
import { StepNavigation } from "@/components/workflow/step-navigation";
import { LLMProgressPanel, LLMStatus } from "@/components/workflow/llm-progress-panel";
import { SourcesPanel } from "@/components/workflow/sources-panel";
import {
  TrustSummary,
  type TrustSummaryData,
  type ClaimVerdict,
} from "@/components/workflow/trust-summary";
import { useProjectStore } from "@/stores/project-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useLLM } from "@/hooks/useLLM";
import { cn } from "@/lib/utils";
import { RESEARCH_SYSTEM_PROMPT, getResearchPrompt } from "@/lib/llm/prompts";
import { extractClaimsFromMarkdown } from "@/lib/research/claims";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ResearchPage({ params }: PageProps) {
  const { id } = use(params);
  const { currentProject, saveResearchData, loadProject } = useProjectStore();
  const { hasValidLLMConfig, llmProvider } = useSettingsStore();
  const { streamResearch } = useLLM();

  const [topic, setTopic] = useState("");
  const [depth, setDepth] = useState<"quick" | "detailed" | "comprehensive">("detailed");
  const [content, setContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // LLM Progress tracking
  const [llmStatus, setLlmStatus] = useState<LLMStatus>("idle");
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [streamingOutput, setStreamingOutput] = useState<string>("");
  const [llmError, setLlmError] = useState<string>("");
  const [researchPhase, setResearchPhase] = useState<string>("");

  // Citation grounding (Phase 3)
  const [trustSummary, setTrustSummary] = useState<TrustSummaryData | null>(null);
  const [verdicts, setVerdicts] = useState<ClaimVerdict[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);

  // Load existing research data
  useEffect(() => {
    if (currentProject?.researchData) {
      setTopic(currentProject.researchData.topic || "");
      setDepth(currentProject.researchData.depth || "detailed");
      setContent(currentProject.researchData.content || "");
    }
  }, [currentProject]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    setIsGenerating(true);
    setContent("");
    setLlmError("");
    setStreamingOutput("");
    setResearchPhase("");
    setTrustSummary(null);
    setVerdicts([]);

    // Set the prompt for display
    const userPrompt = getResearchPrompt(topic, depth);
    setCurrentPrompt(userPrompt);
    setLlmStatus("preparing");

    const generator = streamResearch(topic, depth);
    let fullContent = "";
    let hasError = false;
    let groundedSources: Array<{ title: string; url: string; snippet?: string }> = [];

    setLlmStatus("streaming");

    for await (const message of generator) {
      if (message.type === "text") {
        fullContent += message.content;
        setContent(fullContent);
        setStreamingOutput(fullContent);
      } else if (message.type === "progress") {
        setResearchPhase(message.label ?? "");
      } else if (message.type === "sources") {
        groundedSources = message.sources ?? [];
      } else if (message.type === "error") {
        setContent(`Error: ${message.content}`);
        setLlmError(message.content);
        setLlmStatus("error");
        hasError = true;
        break;
      } else if (message.type === "done") {
        setLlmStatus("complete");
      }
    }

    if (!hasError) {
      setLlmStatus("complete");
      // Auto-save when generation completes
      try {
        // When grounded research returned real sources, persist them as
        // first-class sources (deduped by URL) so claims can link to real
        // source IDs. Otherwise fall back to scraping markdown links.
        let projectSources: Array<{ id: string; url: string | null }> =
          currentProject?.sources ?? [];
        if (groundedSources.length > 0) {
          projectSources = await persistGroundedSources(groundedSources);
        }

        await saveResearchData(id, {
          topic,
          depth,
          content: fullContent,
          sources:
            groundedSources.length > 0 ? groundedSources : extractSources(fullContent),
        });

        // Persist claims separately so the outline step can cite them
        const extracted = extractClaimsFromMarkdown(fullContent, projectSources);
        if (extracted.length > 0) {
          await fetch(`/api/projects/${id}/claims`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: extracted }),
          });
        }
        await loadProject(id);

        // Grounded run → verify citations automatically (Phase 3).
        if (groundedSources.length > 0 && extracted.length > 0) {
          await runVerification();
        }
      } catch (error) {
        console.error(`Auto-save failed: ${(error as Error).message}`);
      }
    }
    setResearchPhase("");
    setIsGenerating(false);
  };

  const runVerification = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch(`/api/projects/${id}/claims/verify`, { method: "POST" });
      if (!res.ok) {
        console.error(`Verification failed: HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      setTrustSummary(data.summary ?? null);
      setVerdicts(data.verdicts ?? []);
    } catch (error) {
      console.error(`Verification error: ${(error as Error).message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Persist grounded sources to the first-class sources table, skipping URLs
   * already present, then return the refreshed source list (with IDs) so claims
   * can be linked to them.
   */
  const persistGroundedSources = async (
    grounded: Array<{ title: string; url: string; snippet?: string }>
  ): Promise<Array<{ id: string; url: string | null }>> => {
    let existing: Array<{ id: string; url: string | null }> = [];
    try {
      const res = await fetch(`/api/projects/${id}/sources`);
      if (res.ok) existing = await res.json();
    } catch {
      /* fall through with empty existing */
    }
    const existingUrls = new Set(existing.map((s) => s.url).filter(Boolean));
    const toAdd = grounded.filter((s) => s.url && !existingUrls.has(s.url));

    await Promise.all(
      toAdd.map((s) =>
        fetch(`/api/projects/${id}/sources`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "url", url: s.url, title: s.title }),
        }).catch(() => undefined)
      )
    );

    try {
      const refreshed = await fetch(`/api/projects/${id}/sources`);
      if (refreshed.ok) return await refreshed.json();
    } catch {
      /* fall through */
    }
    return existing;
  };

  const handleSaveAndNext = async () => {
    if (!content.trim()) {
      return false;
    }


    try {
      await saveResearchData(id, {
        topic,
        depth,
        content,
        sources: extractSources(content),
      });
      return true;
    } catch (error) {
      console.error(`handleSaveAndNext failed: ${(error as Error).message}`);
      return false;
    }
  };

  const extractSources = (text: string): Array<{ title: string; url: string }> => {
    // Simple extraction of markdown links as sources
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const sources: Array<{ title: string; url: string }> = [];
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      sources.push({ title: match[1], url: match[2] });
    }

    return sources;
  };

  const isValid = hasValidLLMConfig();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <StepContainer
        className="flex-1 min-h-0"
        title="Research"
        description="Research your topic to gather information for your video"
        icon="🔍"
        actions={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Using: {llmProvider === "anthropic" ? "Anthropic API" : "Claude CLI"}</span>
          </div>
        }
      >
        <div className="p-6 space-y-6">
          {!isValid && (
            <Card className="border-yellow-500 bg-yellow-500/10">
              <CardContent className="flex items-center gap-4 py-4">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div className="flex-1">
                  <p className="font-medium">LLM not configured</p>
                  <p className="text-sm text-muted-foreground">
                    Please configure your Anthropic API key or Claude CLI in settings.
                  </p>
                </div>
                <Link href="/settings">
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="topic">Topic</Label>
              <div className="flex gap-2">
                <Input
                  id="topic"
                  placeholder="Enter your video topic..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={isGenerating}
                />
                <Button
                  onClick={handleGenerate}
                  disabled={!topic.trim() || isGenerating || !isValid}
                >
                  {isGenerating ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      {researchPhase || "Researching..."}
                    </span>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Research Depth</Label>
              <Select
                value={depth}
                onValueChange={(v) => setDepth(v as typeof depth)}
                disabled={isGenerating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick">Quick (300-500 words)</SelectItem>
                  <SelectItem value="detailed">Detailed (800-1200 words)</SelectItem>
                  <SelectItem value="comprehensive">Comprehensive (1500-2500 words)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sources + claims (issue #4) */}
          <SourcesPanel
            projectId={id}
            sources={currentProject?.sources ?? []}
            claims={currentProject?.claims ?? []}
            onChange={() => {
              void loadProject(id);
            }}
          />

          {/* Citation grounding / verification (Phase 3) */}
          <TrustSummary
            summary={trustSummary}
            verdicts={verdicts}
            claimText={Object.fromEntries(
              (currentProject?.claims ?? []).map((c) => [c.id, c.text])
            )}
            isVerifying={isVerifying}
            onVerify={runVerification}
          />

          {/* LLM Progress Panel */}
          <LLMProgressPanel
            status={llmStatus}
            prompt={currentPrompt}
            systemPrompt={RESEARCH_SYSTEM_PROMPT}
            output={streamingOutput}
            error={llmError}
            provider={llmProvider === "anthropic" ? "Anthropic API" : "Claude CLI"}
            model={llmProvider === "anthropic" ? "Claude Sonnet" : undefined}
          />

          <div className="space-y-2">
            <Label htmlFor="content">Research Content</Label>
            <Textarea
              id="content"
              placeholder="Your research content will appear here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className={cn(
                "min-h-[400px] font-mono text-sm",
                isGenerating && "animate-pulse"
              )}
            />
            <p className="text-xs text-muted-foreground">
              {content.split(/\s+/).filter(Boolean).length} words
            </p>
          </div>
        </div>
      </StepContainer>

      <StepNavigation
        projectId={id}
        currentStep={1}
        onNext={handleSaveAndNext}
        isNextDisabled={!content.trim()}
        isNextLoading={isGenerating}
        nextLabel="Continue to Content"
      />
    </div>
  );
}
