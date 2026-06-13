"use client";

import { Film } from "lucide-react";
import { cn } from "@/lib/utils";
import { SlideCanvas } from "@/components/workflow/slide-canvas";
import { EmptyState } from "@/components/ui/empty-state";

export type PreviewTransition = "none" | "fade" | "slide";

interface SlideLike {
  markdown: string;
  theme?: string | null;
}

interface VideoPreviewStageProps {
  slides: SlideLike[];
  index: number;
  transition: PreviewTransition;
  /** Current slide's script text, shown as a caption when enabled. */
  caption?: string;
  showCaptions: boolean;
}

/** Map the export transition setting to its entrance-animation class. */
export function transitionClass(transition: PreviewTransition): string {
  if (transition === "fade") return "stage-fade";
  if (transition === "slide") return "stage-slide";
  return "";
}

/**
 * The video preview "stage": renders the active slide at full 16:9 fidelity
 * (via SlideCanvas), replays the chosen transition on slide change (React key
 * remount → CSS animation), and overlays burned-in-style captions. Transition
 * CSS is reduced-motion safe (see globals.css).
 */
export function VideoPreviewStage({
  slides,
  index,
  transition,
  caption,
  showCaptions,
}: VideoPreviewStageProps) {
  const slide = slides[index];

  return (
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
      {slide ? (
        <div
          key={index}
          className={cn("w-full h-full", transitionClass(transition))}
          data-testid="video-stage-slide"
        >
          <SlideCanvas
            markdown={slide.markdown}
            theme={slide.theme ?? "default"}
            variant="preview"
            className="!rounded-none !border-0 h-full"
          />
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/90">
          <EmptyState
            size="sm"
            className="[&_p]:text-white/70"
            icon={<Film className="w-6 h-6" />}
            title="No slides to preview"
            description="Complete the earlier steps to preview your video here."
          />
        </div>
      )}

      {/* Caption overlay (burned-in style) */}
      {slide && showCaptions && caption && (
        <div
          className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-5 pointer-events-none"
          data-testid="video-stage-caption"
        >
          <p className="max-w-[85%] rounded bg-black/75 px-3 py-1.5 text-center text-sm md:text-base font-medium text-white line-clamp-2 shadow-lg">
            {caption}
          </p>
        </div>
      )}

      {/* Slide indicator */}
      <div className="absolute top-4 right-4 bg-black/50 px-2 py-1 rounded text-white text-sm tabular-nums">
        Slide {index + 1} / {slides.length}
      </div>
    </div>
  );
}
