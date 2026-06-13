"use client";

import { Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { SlideCanvas } from "@/components/workflow/slide-canvas";

/** Deterministic gradient (two hues) derived from a project name. */
export function gradientFromName(name: string): { from: string; to: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const h1 = hash % 360;
  const h2 = (h1 + 40 + ((hash >> 8) % 60)) % 360;
  return {
    from: `hsl(${h1} 70% 55%)`,
    to: `hsl(${h2} 70% 42%)`,
  };
}

function svgToDataUrl(svg: string): string {
  if (typeof window === "undefined") return "";
  return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
}

interface ProjectCardPreviewProps {
  name: string;
  thumbnailSvg?: string | null;
  slideMarkdown?: string | null;
  slideTheme?: string | null;
  className?: string;
}

/**
 * Visual identity for a project card. Fallback chain:
 *   selected thumbnail SVG → first slide (SlideCanvas) → name-derived gradient.
 */
export function ProjectCardPreview({
  name,
  thumbnailSvg,
  slideMarkdown,
  slideTheme,
  className,
}: ProjectCardPreviewProps) {
  if (thumbnailSvg) {
    return (
      <div
        className={cn("relative aspect-video w-full overflow-hidden rounded-md bg-muted", className)}
        data-testid="card-preview-thumbnail"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={svgToDataUrl(thumbnailSvg)}
          alt={`${name} thumbnail`}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (slideMarkdown) {
    return (
      <div
        className={cn("relative w-full overflow-hidden rounded-md", className)}
        data-testid="card-preview-slide"
      >
        <SlideCanvas
          markdown={slideMarkdown}
          theme={slideTheme ?? "default"}
          variant="thumbnail"
          className="!rounded-md"
        />
      </div>
    );
  }

  const { from, to } = gradientFromName(name || "Untitled");
  const initial = (name.trim()[0] || "?").toUpperCase();
  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-md flex items-center justify-center",
        className
      )}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      data-testid="card-preview-gradient"
    >
      <span className="text-3xl font-bold text-white/90">{initial}</span>
      <Video className="absolute bottom-2 right-2 h-4 w-4 text-white/60" />
    </div>
  );
}
