"use client";

import { useState, useEffect, use } from "react";
import { Sparkles, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StepContainer } from "@/components/workflow/step-container";
import { StepNavigation } from "@/components/workflow/step-navigation";
import { LLMProgressPanel, LLMStatus } from "@/components/workflow/llm-progress-panel";
import { useProjectStore } from "@/stores/project-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useLLM } from "@/hooks/useLLM";
import { estimateReadingTime, formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { SCRIPT_SYSTEM_PROMPT, getScriptPrompt } from "@/lib/llm/prompts";
import { debug } from "@/lib/debug";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface ScriptData {
  slideIndex: number;
  slideId?: string;
  text: string;
  speakerNotes?: string;
  estimatedDuration: number;
}

export default function ScriptPage({ params }: PageProps) {
  const { id } = use(params);
  const { currentProject, saveScripts } = useProjectStore();
  const { llmProvider } = useSettingsStore();
  const { streamScript, isStreaming, hasValidConfig } = useLLM();

  const [scripts, setScripts] = useState<ScriptData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);

  // LLM Progress tracking
  const [llmStatus, setLlmStatus] = useState<LLMStatus>("idle");
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [streamingOutput, setStreamingOutput] = useState<string>("");
  const [llmError, setLlmError] = useState<string>("");

  // Initialize scripts from slides
  useEffect(() => {
    if (currentProject?.scripts && currentProject.scripts.length > 0) {
      // Load existing scripts
      setScripts(
        currentProject.scripts.map((s) => ({
          slideIndex: s.slideIndex,
          slideId: s.slideId || undefined,
          text: s.text,
          speakerNotes: s.speakerNotes || undefined,
          estimatedDuration: s.estimatedDuration || 0,
        }))
      );
    } else if (currentProject?.slides) {
      // Initialize empty scripts for each slide
      setScripts(
        currentProject.slides.map((slide, index) => ({
          slideIndex: index,
          slideId: slide.id,
          text: "",
          estimatedDuration: 0,
        }))
      );
    }
  }, [currentProject]);

  const currentScript = scripts[currentSlideIndex];
  const currentSlide = currentProject?.slides?.[currentSlideIndex];

  const handleScriptChange = (text: string) => {
    setScripts((prev) =>
      prev.map((script, i) =>
        i === currentSlideIndex
          ? { ...script, text, estimatedDuration: estimateReadingTime(text) }
          : script
      )
    );
  };

  const handleGenerateScript = async (index: number) => {
    if (!currentProject?.slides?.[index]) return;

    debug.llmEvent("start", `script for slide ${index + 1}`);
    setIsGenerating(true);
    setGeneratingIndex(index);
    setLlmError("");
    setStreamingOutput("");

    const slideContent = currentProject.slides[index].markdown;

    // Set the prompt for display
    const userPrompt = getScriptPrompt(slideContent, index);
    setCurrentPrompt(userPrompt);
    setLlmStatus("preparing");

    const generator = streamScript(slideContent, index);
    let fullText = "";
    let hasError = false;

    setLlmStatus("streaming");
    debug.llmEvent("streaming", "receiving chunks");

    for await (const message of generator) {
      if (message.type === "text") {
        fullText += message.content;
        setStreamingOutput(fullText);
        setScripts((prev) =>
          prev.map((script, i) =>
            i === index
              ? { ...script, text: fullText, estimatedDuration: estimateReadingTime(fullText) }
              : script
          )
        );
      } else if (message.type === "error") {
        debug.llmEvent("error", message.content);
        console.error("Script generation error:", message.content);
        setLlmError(message.content);
        setLlmStatus("error");
        hasError = true;
        break;
      } else if (message.type === "done") {
        debug.llmEvent("complete", `${fullText.length} chars generated for slide ${index + 1}`);
        setLlmStatus("complete");
      }
    }

    if (!hasError) {
      setLlmStatus("complete");
      // Auto-save the updated scripts after generation completes
      debug.log("workflow", `Script generation complete for slide ${index + 1}, auto-saving...`);
      try {
        // Get the updated scripts including the newly generated one
        const updatedScripts = scripts.map((script, i) =>
          i === index
            ? { ...script, text: fullText, estimatedDuration: estimateReadingTime(fullText) }
            : script
        );
        await saveScripts(id, updatedScripts);
        debug.log("workflow", "Auto-save complete");
      } catch (error) {
        debug.error("workflow", `Auto-save failed: ${(error as Error).message}`);
      }
    }
    setIsGenerating(false);
    setGeneratingIndex(null);
  };

  const handleGenerateAll = async () => {
    if (!currentProject?.slides) return;

    for (let i = 0; i < currentProject.slides.length; i++) {
      if (!scripts[i]?.text) {
        await handleGenerateScript(i);
      }
    }
  };

  const handlePreviousSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  const handleNextSlide = () => {
    if (currentSlideIndex < scripts.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const handleSaveAndNext = async () => {
    const validScripts = scripts.filter((s) => s.text.trim());
    if (validScripts.length === 0) {
      debug.warn("workflow", "handleSaveAndNext: no scripts to save");
      return false;
    }

    debug.log("workflow", `handleSaveAndNext: saving ${validScripts.length} scripts...`);

    try {
      await saveScripts(id, scripts);
      debug.log("workflow", "handleSaveAndNext: scripts saved successfully");
      return true;
    } catch (error) {
      debug.error("workflow", `handleSaveAndNext failed: ${(error as Error).message}`);
      return false;
    }
  };

  const totalDuration = scripts.reduce((sum, s) => sum + s.estimatedDuration, 0);
  const completedScripts = scripts.filter((s) => s.text.trim()).length;

  return (
    <div className="flex flex-col h-full">
      <StepContainer
        title="Script"
        description="Write or generate video scripts for each slide"
        icon="📜"
        actions={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Est. Duration: {formatDuration(totalDuration)}</span>
            </div>
            <Button
              variant="outline"
              onClick={handleGenerateAll}
              disabled={isGenerating || !hasValidConfig}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate All
            </Button>
          </div>
        }
      >
        <div className="flex-1 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Slide Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Slide Preview</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePreviousSlide}
                    disabled={currentSlideIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[60px] text-center">
                    {currentSlideIndex + 1} / {scripts.length}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNextSlide}
                    disabled={currentSlideIndex === scripts.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Card className="aspect-video overflow-hidden">
                <CardContent className="p-6 h-full overflow-auto">
                  {currentSlide ? (
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{
                        __html: currentSlide.markdown
                          .replace(/^# (.+)$/gm, "<h1>$1</h1>")
                          .replace(/^## (.+)$/gm, "<h2>$1</h2>")
                          .replace(/^- (.+)$/gm, "<li>$1</li>")
                          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                          .replace(/<!--[\s\S]*?-->/g, "")
                          .replace(/\n/g, "<br />"),
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No slide content
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Script Progress */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">
                    Progress: {completedScripts} / {scripts.length} scripts
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-0 pb-3">
                  <div className="flex gap-1">
                    {scripts.map((script, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentSlideIndex(index)}
                        className={cn(
                          "flex-1 h-2 rounded-full transition-colors",
                          script.text.trim()
                            ? "bg-primary"
                            : "bg-muted",
                          index === currentSlideIndex && "ring-2 ring-primary ring-offset-2"
                        )}
                        title={`Slide ${index + 1}${script.text ? " - Complete" : ""}`}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Script Editor */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Script for Slide {currentSlideIndex + 1}</Label>
                <Button
                  size="sm"
                  onClick={() => handleGenerateScript(currentSlideIndex)}
                  disabled={isGenerating || !hasValidConfig}
                >
                  {generatingIndex === currentSlideIndex ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      Generating...
                    </span>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-1" />
                      Generate
                    </>
                  )}
                </Button>
              </div>

              {/* LLM Progress Panel */}
              <LLMProgressPanel
                status={llmStatus}
                prompt={currentPrompt}
                systemPrompt={SCRIPT_SYSTEM_PROMPT}
                output={streamingOutput}
                error={llmError}
                provider={llmProvider === "anthropic" ? "Anthropic API" : "Claude CLI"}
                model={llmProvider === "anthropic" ? "Claude Sonnet" : undefined}
              />

              <Textarea
                value={currentScript?.text || ""}
                onChange={(e) => handleScriptChange(e.target.value)}
                className={cn(
                  "min-h-[300px] text-base leading-relaxed",
                  generatingIndex === currentSlideIndex && "animate-pulse"
                )}
                placeholder="Write your script here or click Generate to create one automatically..."
              />

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {currentScript?.text.split(/\s+/).filter(Boolean).length || 0} words
                </span>
                <span>
                  Est. duration: {formatDuration(currentScript?.estimatedDuration || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </StepContainer>

      <StepNavigation
        projectId={id}
        currentStep={4}
        onNext={handleSaveAndNext}
        isNextDisabled={completedScripts === 0}
        isNextLoading={isGenerating}
        nextLabel="Continue to Recording"
      />
    </div>
  );
}
