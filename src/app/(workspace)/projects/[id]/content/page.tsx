"use client";

import { useState, useEffect, use } from "react";
import { Sparkles, AlertCircle, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StepContainer } from "@/components/workflow/step-container";
import { StepNavigation } from "@/components/workflow/step-navigation";
import { LLMProgressPanel, LLMStatus } from "@/components/workflow/llm-progress-panel";
import { useProjectStore } from "@/stores/project-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useLLM } from "@/hooks/useLLM";
import { cn } from "@/lib/utils";
import { CONTENT_SYSTEM_PROMPT, getContentPrompt } from "@/lib/llm/prompts";
import { debug } from "@/lib/debug";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ContentPage({ params }: PageProps) {
  const { id } = use(params);
  const { currentProject, saveContentData } = useProjectStore();
  const { hasValidLLMConfig, llmProvider } = useSettingsStore();
  const { streamContent, isStreaming } = useLLM();

  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<"presentation" | "tutorial" | "explainer">("presentation");
  const [targetLength, setTargetLength] = useState(10);
  const [markdown, setMarkdown] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("edit");

  // LLM Progress tracking
  const [llmStatus, setLlmStatus] = useState<LLMStatus>("idle");
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [streamingOutput, setStreamingOutput] = useState<string>("");
  const [llmError, setLlmError] = useState<string>("");

  // Load existing content data
  useEffect(() => {
    if (currentProject?.contentData) {
      setTitle(currentProject.contentData.title || "");
      setFormat(currentProject.contentData.format || "presentation");
      setTargetLength(currentProject.contentData.targetLength || 10);
      setMarkdown(currentProject.contentData.markdown || "");
    }
  }, [currentProject]);

  const handleGenerate = async () => {
    if (!currentProject?.researchData?.content) return;

    debug.llmEvent("start", `content generation for format: ${format}`);
    setIsGenerating(true);
    setMarkdown("");
    setLlmError("");
    setStreamingOutput("");

    // Set the prompt for display
    const userPrompt = getContentPrompt(currentProject.researchData.content, format, targetLength);
    setCurrentPrompt(userPrompt);
    setLlmStatus("preparing");

    const generator = streamContent(
      currentProject.researchData.content,
      format,
      targetLength
    );
    let fullContent = "";
    let hasError = false;

    setLlmStatus("streaming");
    debug.llmEvent("streaming", "receiving chunks");

    for await (const message of generator) {
      if (message.type === "text") {
        fullContent += message.content;
        setMarkdown(fullContent);
        setStreamingOutput(fullContent);
      } else if (message.type === "error") {
        debug.llmEvent("error", message.content);
        setMarkdown(`Error: ${message.content}`);
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
      debug.log("workflow", "LLM generation complete, auto-saving content...");
      try {
        // Parse outline from markdown for saving
        const sections = fullContent.split("---").filter((s) => s.trim());
        const outline = sections.map((section) => {
          const lines = section.trim().split("\n");
          const titleLine = lines.find((l) => l.startsWith("#")) || "";
          const sectionTitle = titleLine.replace(/^#+\s*/, "").trim();
          const points = lines
            .filter((l) => l.startsWith("-") || l.startsWith("*"))
            .map((l) => l.replace(/^[-*]\s*/, "").trim());
          return { title: sectionTitle, points };
        });

        await saveContentData(id, {
          title,
          format,
          targetLength,
          outline,
          markdown: fullContent,
        });
        debug.log("workflow", "Auto-save complete");
      } catch (error) {
        debug.error("workflow", `Auto-save failed: ${(error as Error).message}`);
      }
    }
    setIsGenerating(false);
  };

  const handleSaveAndNext = async () => {
    if (!markdown.trim()) {
      debug.warn("workflow", "handleSaveAndNext: no markdown content");
      return false;
    }

    debug.log("workflow", "handleSaveAndNext: saving content data...");

    // Parse outline from markdown
    const sections = markdown.split("---").filter((s) => s.trim());
    const outline = sections.map((section) => {
      const lines = section.trim().split("\n");
      const titleLine = lines.find((l) => l.startsWith("#")) || "";
      const sectionTitle = titleLine.replace(/^#+\s*/, "").trim();
      const points = lines
        .filter((l) => l.startsWith("-") || l.startsWith("*"))
        .map((l) => l.replace(/^[-*]\s*/, "").trim());
      return { title: sectionTitle, points };
    });

    try {
      await saveContentData(id, {
        title,
        format,
        targetLength,
        outline,
        markdown,
      });
      debug.log("workflow", "handleSaveAndNext: content saved successfully");
      return true;
    } catch (error) {
      debug.error("workflow", `handleSaveAndNext failed: ${(error as Error).message}`);
      return false;
    }
  };

  const isValid = hasValidLLMConfig();
  const hasResearch = !!currentProject?.researchData?.content;

  // Simple markdown preview
  const renderPreview = () => {
    const slides = markdown.split("---").filter((s) => s.trim());
    return (
      <div className="space-y-4">
        {slides.map((slide, index) => (
          <Card key={index} className="overflow-hidden">
            <div className="bg-muted px-4 py-2 text-sm font-medium">
              Slide {index + 1}
            </div>
            <CardContent className="p-4 prose prose-sm max-w-none dark:prose-invert">
              <div
                dangerouslySetInnerHTML={{
                  __html: slide
                    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
                    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
                    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
                    .replace(/^- (.+)$/gm, "<li>$1</li>")
                    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                    .replace(/\*(.+?)\*/g, "<em>$1</em>")
                    .replace(/\n/g, "<br />"),
                }}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <StepContainer
        title="Content"
        description="Generate presentation content from your research"
        icon="📝"
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

          {!hasResearch && (
            <Card className="border-yellow-500 bg-yellow-500/10">
              <CardContent className="flex items-center gap-4 py-4">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div className="flex-1">
                  <p className="font-medium">No research found</p>
                  <p className="text-sm text-muted-foreground">
                    Please complete the research step first before generating content.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="title">Presentation Title</Label>
              <Input
                id="title"
                placeholder="Enter your presentation title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isGenerating}
              />
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <Select
                value={format}
                onValueChange={(v) => setFormat(v as typeof format)}
                disabled={isGenerating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presentation">Presentation</SelectItem>
                  <SelectItem value="tutorial">Tutorial</SelectItem>
                  <SelectItem value="explainer">Explainer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Length</Label>
              <Select
                value={targetLength.toString()}
                onValueChange={(v) => setTargetLength(parseInt(v))}
                disabled={isGenerating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="20">20 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !isValid || !hasResearch}
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Generating...
                </span>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Content
                </>
              )}
            </Button>
          </div>

          {/* LLM Progress Panel */}
          <LLMProgressPanel
            status={llmStatus}
            prompt={currentPrompt}
            systemPrompt={CONTENT_SYSTEM_PROMPT}
            output={streamingOutput}
            error={llmError}
            provider={llmProvider === "anthropic" ? "Anthropic API" : "Claude CLI"}
            model={llmProvider === "anthropic" ? "Claude Sonnet" : undefined}
          />

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="mt-4">
              <Textarea
                placeholder="Your presentation content will appear here in Slidev markdown format..."
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                className={cn(
                  "min-h-[400px] font-mono text-sm",
                  isGenerating && "animate-pulse"
                )}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {markdown.split("---").filter((s) => s.trim()).length} slides •{" "}
                {markdown.split(/\s+/).filter(Boolean).length} words
              </p>
            </TabsContent>
            <TabsContent value="preview" className="mt-4">
              <div className="max-h-[500px] overflow-auto">
                {markdown ? renderPreview() : (
                  <div className="text-center py-12 text-muted-foreground">
                    No content to preview yet
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </StepContainer>

      <StepNavigation
        projectId={id}
        currentStep={2}
        onNext={handleSaveAndNext}
        isNextDisabled={!markdown.trim()}
        isNextLoading={isGenerating}
        nextLabel="Continue to Slides"
      />
    </div>
  );
}
