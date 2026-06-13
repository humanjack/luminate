"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface YouTubePreviewProps {
  /** Data URL (or any <img> src) for the thumbnail. */
  imageUrl: string;
  /** The video title (SEO title or project name). */
  title: string;
  /** Channel name shown under the title. */
  channel?: string;
  /** Illustrative duration pill, e.g. "10:24". */
  duration?: string;
  className?: string;
}

/**
 * Renders a thumbnail inside faithful YouTube surface mockups (search-result
 * row + "up next" sidebar card) so creators can see how it will actually look
 * on YouTube. Purely presentational; metadata other than the title is
 * illustrative placeholder.
 */
export function YouTubePreview({
  imageUrl,
  title,
  channel = "Your Channel",
  duration = "10:24",
  className,
}: YouTubePreviewProps) {
  const [dark, setDark] = useState(true);

  const surface = dark ? "bg-[#0f0f0f] text-white" : "bg-white text-[#0f0f0f]";
  const subtle = dark ? "text-[#aaaaaa]" : "text-[#606060]";

  return (
    <div className={cn("space-y-3", className)} data-testid="youtube-preview">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          How it looks on YouTube
        </span>
        <button
          type="button"
          onClick={() => setDark((d) => !d)}
          data-testid="yt-theme-toggle"
          className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground hover:bg-muted transition-colors"
        >
          {dark ? "Dark" : "Light"}
        </button>
      </div>

      <div className={cn("rounded-xl p-4 space-y-5", surface)}>
        {/* Search-result row */}
        <div className="flex gap-3">
          <Thumb imageUrl={imageUrl} duration={duration} className="w-[180px] shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium leading-snug line-clamp-2">
              {title}
            </p>
            <p className={cn("text-xs mt-1", subtle)}>
              {channel}
            </p>
            <p className={cn("text-xs", subtle)}>12K views · 2 days ago</p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={cn(
                  "h-6 w-6 rounded-full shrink-0",
                  dark ? "bg-[#373737]" : "bg-[#e5e5e5]"
                )}
              />
              <span className={cn("text-xs truncate", subtle)}>{channel}</span>
            </div>
          </div>
        </div>

        {/* Sidebar "up next" card */}
        <div>
          <p className={cn("text-[11px] uppercase tracking-wide mb-2", subtle)}>
            Up next (sidebar)
          </p>
          <div className="flex gap-2">
            <Thumb imageUrl={imageUrl} duration={duration} className="w-[160px] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium leading-tight line-clamp-2">
                {title}
              </p>
              <p className={cn("text-[11px] mt-1", subtle)}>{channel}</p>
              <p className={cn("text-[11px]", subtle)}>12K views</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Thumb({
  imageUrl,
  duration,
  className,
}: {
  imageUrl: string;
  duration: string;
  className?: string;
}) {
  return (
    <div className={cn("relative rounded-lg overflow-hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Video thumbnail preview"
        className="w-full aspect-video object-cover bg-black/20"
      />
      <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium text-white tabular-nums">
        {duration}
      </span>
    </div>
  );
}
