"use client";

import { useState, useEffect, use } from "react";
import { ChevronLeft, ChevronRight, Palette, Download, Image } from "lucide-react";
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
import { useProjectStore } from "@/stores/project-store";
import { cn } from "@/lib/utils";

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
  const [theme, setTheme] = useState("default");

  // Parse slides from content markdown
  useEffect(() => {
    if (currentProject?.slides && currentProject.slides.length > 0) {
      // Load existing slides
      setSlides(
        currentProject.slides.map((s) => ({
          id: s.id,
          markdown: s.markdown,
          imageData: s.imageData || undefined,
          theme: s.theme || "default",
        }))
      );
      if (currentProject.slides[0]?.theme) {
        setTheme(currentProject.slides[0].theme);
      }
    } else if (currentProject?.contentData?.markdown) {
      // Parse from content markdown
      const sections = currentProject.contentData.markdown
        .split("---")
        .filter((s) => s.trim());
      setSlides(sections.map((markdown) => ({ markdown: markdown.trim() })));
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
    if (slides.length === 0) return false;

    await saveSlides(
      id,
      slides.map((slide, index) => ({
        ...slide,
        index,
        theme,
      }))
    );

    return true;
  };

  // Simple slide preview renderer
  const renderSlidePreview = (markdown: string) => {
    return (
      <div
        className={cn(
          "aspect-video rounded-lg p-8 flex flex-col justify-center",
          theme === "default" && "bg-gradient-to-br from-primary/10 to-primary/5 border",
          theme === "dark" && "bg-slate-900 text-white border border-slate-700",
          theme === "light" && "bg-white text-slate-900 border shadow-lg",
          theme === "minimal" && "bg-gray-50 text-gray-900 border"
        )}
      >
        <div
          className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{
            __html: markdown
              .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mb-4">$1</h1>')
              .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-semibold mb-3">$1</h2>')
              .replace(/^### (.+)$/gm, '<h3 class="text-xl font-medium mb-2">$1</h3>')
              .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
              .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$2</li>')
              .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
              .replace(/\*(.+?)\*/g, "<em>$1</em>")
              .replace(/`(.+?)`/g, '<code class="bg-muted px-1 rounded">$1</code>')
              .replace(/<!--[\s\S]*?-->/g, "") // Remove HTML comments
              .replace(/\n\n/g, "</p><p>")
              .replace(/\n/g, "<br />"),
          }}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <StepContainer
        title="Slides"
        description="Edit and preview your presentation slides"
        icon="🎨"
        actions={
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="minimal">Minimal</SelectItem>
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
                renderSlidePreview(currentSlide.markdown)
              ) : (
                <div className="aspect-video rounded-lg border bg-muted flex items-center justify-center">
                  <p className="text-muted-foreground">No slides to display</p>
                </div>
              )}

              {/* Slide Thumbnails */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {slides.map((slide, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlideIndex(index)}
                    className={cn(
                      "flex-shrink-0 w-24 h-16 rounded border overflow-hidden",
                      index === currentSlideIndex
                        ? "ring-2 ring-primary"
                        : "hover:border-primary/50"
                    )}
                  >
                    <div className="w-full h-full bg-muted text-[6px] p-1 overflow-hidden">
                      {slide.markdown.slice(0, 100)}...
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
        nextLabel="Continue to Script"
      />
    </div>
  );
}
