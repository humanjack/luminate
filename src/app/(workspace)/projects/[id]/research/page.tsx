"use client";

import { useState, useEffect, use } from "react";
import { Search, Sparkles, AlertCircle, Settings } from "lucide-react";
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
import { useProjectStore } from "@/stores/project-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useLLM } from "@/hooks/useLLM";
import { cn } from "@/lib/utils";
import { RESEARCH_SYSTEM_PROMPT, getResearchPrompt } from "@/lib/llm/prompts";
import { debug } from "@/lib/debug";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ResearchPage({ params }: PageProps) {
  const { id } = use(params);
  const { currentProject, saveResearchData } = useProjectStore();
  const { hasValidLLMConfig, llmProvider } = useSettingsStore();
  const { streamResearch, isStreaming } = useLLM();

  const [topic, setTopic] = useState("");
  const [depth, setDepth] = useState<"quick" | "detailed" | "comprehensive">("detailed");
  const [content, setContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // LLM Progress tracking
  const [llmStatus, setLlmStatus] = useState<LLMStatus>("idle");
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [streamingOutput, setStreamingOutput] = useState<string>("");
  const [llmError, setLlmError] = useState<string>("");

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

    debug.llmEvent("start", `research for topic: ${topic}`);
    setIsGenerating(true);
    setContent("");
    setLlmError("");
    setStreamingOutput("");

    // Set the prompt for display
    const userPrompt = getResearchPrompt(topic, depth);
    setCurrentPrompt(userPrompt);
    setLlmStatus("preparing");

    const generator = streamResearch(topic, depth);
    let fullContent = "";
    let hasError = false;

    setLlmStatus("streaming");
    debug.llmEvent("streaming", "receiving chunks");

    for await (const message of generator) {
      if (message.type === "text") {
        fullContent += message.content;
        setContent(fullContent);
        setStreamingOutput(fullContent);
      } else if (message.type === "error") {
        debug.llmEvent("error", message.content);
        setContent(`Error: ${message.content}`);
        setLlmError(message.content);
        setLlmStatus("error");
        hasError = true;
        break;
      } else if (message.type === "done") {
        debug.llmEvent("complete", `${fullContent.length} chars generated`);
        setLlmStatus("complete");
      }
    }

    if (!hasError) {
      setLlmStatus("complete");
      // Auto-save when generation completes
      debug.log("workflow", "LLM generation complete, auto-saving research...");
      try {
        await saveResearchData(id, {
          topic,
          depth,
          content: fullContent,
          sources: extractSources(fullContent),
        });
        debug.log("workflow", "Auto-save complete");
      } catch (error) {
        debug.error("workflow", `Auto-save failed: ${(error as Error).message}`);
      }
    }
    setIsGenerating(false);
  };

  const handleSaveAndNext = async () => {
    if (!content.trim()) {
      debug.warn("workflow", "handleSaveAndNext: no research content");
      return false;
    }

    debug.log("workflow", "handleSaveAndNext: saving research data...");

    try {
      await saveResearchData(id, {
        topic,
        depth,
        content,
        sources: extractSources(content),
      });
      debug.log("workflow", "handleSaveAndNext: research saved successfully");
      return true;
    } catch (error) {
      debug.error("workflow", `handleSaveAndNext failed: ${(error as Error).message}`);
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
                      Researching...
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
