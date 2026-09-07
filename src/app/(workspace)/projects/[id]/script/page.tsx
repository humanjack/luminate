"use client";

import { useState, useEffect, useRef, use } from "react";
import { Sparkles, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StepContainer } from "@/components/workflow/step-container";
import { StepNavigation } from "@/components/workflow/step-navigation";
import { LLMProgressPanel, LLMStatus } from "@/components/workflow/llm-progress-panel";
import { useDraftState } from "@/hooks/use-draft-state";
import { useProjectStore } from "@/stores/project-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useLLM } from "@/hooks/useLLM";
import { estimateReadingTime, formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { SCRIPT_SYSTEM_PROMPT, getScriptPrompt } from "@/lib/llm/prompts";

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
  return <ScriptEditor key={id} id={id} />;
}

function ScriptEditor({ id }: { id: string }) {
  const { currentProject: storedProject, saveScripts } = useProjectStore();
  const currentProject = storedProject?.id === id ? storedProject : null;
  const { llmProvider } = useSettingsStore();
  const { streamScript, hasValidConfig } = useLLM();

  const deckIdentity = JSON.stringify((currentProject?.slides ?? []).map((slide) => slide.id));
  const [scripts, setScripts, acknowledgeScripts] = useDraftState<ScriptData[]>(
    (currentProject?.slides ?? []).map((slide, slideIndex) => {
      const script = currentProject?.scripts?.find((entry) =>
        entry.slideId === slide.id || (!entry.slideId && entry.slideIndex === slideIndex)
      );
      return {
        slideIndex, slideId: slide.id, text: script?.text ?? "",
        speakerNotes: script?.speakerNotes ?? undefined,
        estimatedDuration: script?.estimatedDuration ?? 0,
      };
    }),
    deckIdentity
  );
  const activeDeckRef = useRef<string | null>(deckIdentity);
  useEffect(() => {
    activeDeckRef.current = deckIdentity;
    return () => { activeDeckRef.current = null; };
  }, [deckIdentity]);

  const scriptsRef = useRef<ScriptData[]>([]); // Ref to track current scripts for async operations
  const [currentSlideIndex, setCurrentSlideIndex] = useDraftState(0, deckIdentity);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    scriptsRef.current = scripts;
  }, [scripts]);

  // LLM Progress tracking
  const [llmStatus, setLlmStatus] = useState<LLMStatus>("idle");
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [streamingOutput, setStreamingOutput] = useState<string>("");
  const [llmError, setLlmError] = useState<string>("");

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

    for await (const message of generator) {
      if (activeDeckRef.current !== deckIdentity) {
        setIsGenerating(false);
        setGeneratingIndex(null);
        setLlmStatus("idle");
        return;
      }
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
        console.error("Script generation error:", message.content);
        setLlmError(message.content);
        setLlmStatus("error");
        hasError = true;
        break;
      } else if (message.type === "done") {
        setLlmStatus("complete");
      }
    }

    // The deck may be replaced while awaiting the final stream result.
    if (activeDeckRef.current !== deckIdentity) {
      setIsGenerating(false);
      setGeneratingIndex(null);
      setLlmStatus("idle");
      return;
    }

    if (!hasError) {
      setLlmStatus("complete");
      // Auto-save the updated scripts after generation completes
      try {
        // Use scriptsRef.current to get the latest state (avoids stale closure)
        const currentScripts = scriptsRef.current;
        const updatedScripts = currentScripts.map((script, i) =>
          i === index
            ? { ...script, text: fullText, estimatedDuration: estimateReadingTime(fullText) }
            : script
        );
        setScripts(updatedScripts);
        await saveScripts(id, updatedScripts);
        acknowledgeScripts(updatedScripts);
      } catch (error) {
        console.error(`Auto-save failed: ${(error as Error).message}`);
        setLlmError(`Could not save: ${(error as Error).message}`);
        setLlmStatus("error");
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
      return false;
    }


    try {
      await saveScripts(id, scripts);
      acknowledgeScripts(scripts);
      return true;
    } catch (error) {
      console.error(`handleSaveAndNext failed: ${(error as Error).message}`);
      setLlmError(`Could not save: ${(error as Error).message}`);
      setLlmStatus("error");
      return false;
    }
  };

  const totalDuration = scripts.reduce((sum, s) => sum + s.estimatedDuration, 0);
  const completedScripts = scripts.filter((s) => s.text.trim()).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <StepContainer
        className="flex-1 min-h-0"
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
