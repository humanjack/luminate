"use client";

import { useState, useEffect, use } from "react";
import { ChevronLeft, ChevronRight, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { SlideCanvas } from "@/components/workflow/slide-canvas";
import { SLIDE_THEMES, type SlideTheme } from "@/lib/slides/themes";
import { useProjectStore } from "@/stores/project-store";
import { cn } from "@/lib/utils";
import { debug } from "@/lib/debug";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface SlideData {
  id?: string;
  markdown: string;
  imageData?: string;
  theme?: string;
}

export default function SlidesPage({ params }: PageProps) {
  const { id } = use(params);
  const { currentProject, saveSlides } = useProjectStore();

  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [theme, setTheme] = useState<SlideTheme>("default");
  const [isSaving, setIsSaving] = useState(false);

  // Parse slides from content markdown
  useEffect(() => {
    debug.log("workflow", `Slides page: currentProject exists: ${!!currentProject}`);
    debug.log("workflow", `Slides page: existing slides: ${currentProject?.slides?.length || 0}`);
    debug.log("workflow", `Slides page: contentData exists: ${!!currentProject?.contentData}`);
    debug.log("workflow", `Slides page: contentData.markdown length: ${currentProject?.contentData?.markdown?.length || 0}`);

    if (currentProject?.slides && currentProject.slides.length > 0) {
      // Load existing slides
      debug.log("workflow", `Loading ${currentProject.slides.length} existing slides`);
      setSlides(
        currentProject.slides.map((s) => ({
          id: s.id,
          markdown: s.markdown,
          imageData: s.imageData || undefined,
          theme: s.theme || "default",
        }))
      );
      const t = currentProject.slides[0]?.theme;
      if (t && (SLIDE_THEMES as readonly string[]).includes(t)) {
        setTheme(t as SlideTheme);
      }
    } else if (currentProject?.contentData?.markdown) {
      // Parse from content markdown
      const sections = currentProject.contentData.markdown
        .split("---")
        .filter((s) => s.trim());
      debug.log("workflow", `Parsing ${sections.length} slides from content markdown`);
      setSlides(sections.map((markdown) => ({ markdown: markdown.trim() })));
    } else {
      debug.warn("workflow", "No slides or content data available");
    }
  }, [currentProject]);

  const currentSlide = slides[currentSlideIndex];

  const handleSlideChange = (markdown: string) => {
    setSlides((prev) =>
      prev.map((slide, i) =>
        i === currentSlideIndex ? { ...slide, markdown } : slide
      )
    );
  };

  const handlePreviousSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  const handleNextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const handleSaveAndNext = async () => {
    if (slides.length === 0) {
      debug.warn("workflow", "handleSaveAndNext: no slides to save");
      alert("No slides to save. Please add content first.");
      return false;
    }

    debug.log("workflow", `handleSaveAndNext: saving ${slides.length} slides...`);
    setIsSaving(true);

    try {
      await saveSlides(
        id,
        slides.map((slide, index) => ({
          ...slide,
          index,
          theme,
        }))
      );
      debug.log("workflow", "handleSaveAndNext: slides saved successfully");
      setIsSaving(false);
      return true;
    } catch (error) {
      debug.error("workflow", `handleSaveAndNext failed: ${(error as Error).message}`);
      alert(`Failed to save slides: ${(error as Error).message}`);
      setIsSaving(false);
      return false;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <StepContainer
        className="flex-1 min-h-0"
        title="Slides"
        description="Edit and preview your presentation slides"
        icon="🎨"
        actions={
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <Select value={theme} onValueChange={(v) => setTheme(v as SlideTheme)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="playful">Playful</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <div className="flex-1 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Slide Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Preview</Label>
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
                    {currentSlideIndex + 1} / {slides.length}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNextSlide}
                    disabled={currentSlideIndex === slides.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {currentSlide ? (
                <SlideCanvas
                  markdown={currentSlide.markdown}
                  theme={theme}
                  variant="preview"
                />
              ) : (
                <div className="aspect-video rounded-lg border bg-muted flex items-center justify-center">
                  <p className="text-muted-foreground">No slides to display</p>
                </div>
              )}

              {/* Visual thumbnail rail */}
              <div className="flex gap-2 overflow-x-auto pb-2" data-testid="slide-thumbnail-rail">
                {slides.map((slide, index) => (
                  <button
                    key={slide.id ?? index}
                    onClick={() => setCurrentSlideIndex(index)}
                    aria-label={`Jump to slide ${index + 1}`}
                    className={cn(
                      "flex-shrink-0 w-32 rounded transition focus:outline-none",
                      index === currentSlideIndex
                        ? "ring-2 ring-indigo-500"
                        : "opacity-80 hover:opacity-100"
                    )}
                  >
                    <SlideCanvas
                      markdown={slide.markdown}
                      theme={theme}
                      variant="thumbnail"
                    />
                    <div className="text-[10px] text-muted-foreground text-center mt-1">
                      {index + 1}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Slide Editor */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Slide Content (Markdown)</Label>
                <span className="text-xs text-muted-foreground">
                  Editing slide {currentSlideIndex + 1}
                </span>
              </div>

              <Textarea
                value={currentSlide?.markdown || ""}
                onChange={(e) => handleSlideChange(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                placeholder="Enter slide content in markdown..."
              />

              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2">Markdown Tips</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li><code>#</code> - Main title</li>
                    <li><code>##</code> - Subtitle</li>
                    <li><code>-</code> or <code>*</code> - Bullet points</li>
                    <li><code>**text**</code> - Bold text</li>
                    <li><code>`code`</code> - Inline code</li>
                    <li><code>{"<!-- notes -->"}</code> - Speaker notes (hidden)</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </StepContainer>

      <StepNavigation
        projectId={id}
        currentStep={3}
        onNext={handleSaveAndNext}
        isNextDisabled={slides.length === 0}
        isNextLoading={isSaving}
        nextLabel="Continue to Script"
      />
    </div>
  );
}
