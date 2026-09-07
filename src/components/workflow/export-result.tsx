"use client";

import { CheckCircle2, Download, MonitorPlay, Play, FileText, Captions, BookText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SlideCanvas } from "@/components/workflow/slide-canvas";
import { formatDuration } from "@/lib/utils";

export interface ExportArtifacts {
  mp4?: string;
  captions?: string;
  transcript?: string;
  sources?: string;
}

interface ExportResultProps {
  projectName: string;
  posterMarkdown?: string;
  posterTheme?: string | null;
  slideCount: number;
  totalDuration: number;
  resolution: string;
  artifacts: ExportArtifacts;
  onDownload: (url?: string, filename?: string) => void;
  onUploadYouTube: () => void;
}

/** Confetti colors — fixed palette, index-derived so SSR & client agree. */
const CONFETTI_COLORS = ["#a855f7", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899"];
const CONFETTI_COUNT = 28;

function Confetti() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-testid="export-confetti"
    >
      {Array.from({ length: CONFETTI_COUNT }).map((_, i) => {
        // Deterministic pseudo-spread (no Math.random → hydration-stable).
        const left = (i * 37) % 100;
        const delay = (i % 7) * 90;
        const duration = 1100 + ((i * 53) % 600);
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        return (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${left}%`,
              backgroundColor: color,
              animationDelay: `${delay}ms`,
              animationDuration: `${duration}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

export function ExportResult({
  projectName,
  posterMarkdown,
  posterTheme,
  slideCount,
  totalDuration,
  resolution,
  artifacts,
  onDownload,
  onUploadYouTube,
}: ExportResultProps) {
  const stats = [
    { label: "Duration", value: formatDuration(totalDuration) },
    { label: "Slides", value: String(slideCount) },
    { label: "Resolution", value: resolution },
    { label: "Format", value: "MP4 · H.264" },
  ];

  return (
    <Card
      className="relative overflow-hidden border-emerald-500/40 pop-in"
      data-testid="export-result"
    >
      <Confetti />
      <CardContent className="relative p-5">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-center">
          {/* Poster */}
          <div className="relative">
            <div className="relative rounded-xl overflow-hidden ring-1 ring-border shadow-lg">
              {posterMarkdown ? (
                <SlideCanvas markdown={posterMarkdown} theme={posterTheme ?? "default"} variant="preview" />
              ) : (
                <div className="aspect-video w-full bg-linear-to-br/srgb from-primary/20 to-primary/5" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                <span className="flex items-center justify-center h-14 w-14 rounded-full bg-white/85 text-black shadow-lg">
                  <Play className="h-6 w-6 translate-x-0.5 fill-current" />
                </span>
              </div>
              <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums">
                {formatDuration(totalDuration)}
              </span>
            </div>
          </div>

          {/* Details + actions */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">Your video is ready</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold leading-tight line-clamp-2">{projectName}</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-lg bg-muted/60 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {s.label}
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => onDownload(artifacts.mp4, `${projectName || "video"}.mp4`)}
                data-testid="result-download-mp4"
              >
                <Download className="h-4 w-4 mr-2" />
                Download MP4
              </Button>
              <Button variant="secondary" onClick={onUploadYouTube} data-testid="result-upload">
                <MonitorPlay className="h-4 w-4 mr-2" />
                Upload to YouTube
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <ArtifactChip
                icon={<Captions className="h-3.5 w-3.5" />}
                label="Captions"
                url={artifacts.captions}
                filename={`${projectName || "video"}.vtt`}
                onDownload={onDownload}
                testid="result-download-captions"
              />
              <ArtifactChip
                icon={<FileText className="h-3.5 w-3.5" />}
                label="Transcript"
                url={artifacts.transcript}
                filename={`${projectName || "video"}.transcript.txt`}
                onDownload={onDownload}
                testid="result-download-transcript"
              />
              <ArtifactChip
                icon={<BookText className="h-3.5 w-3.5" />}
                label="Sources"
                url={artifacts.sources}
                filename={`${projectName || "video"}.sources.md`}
                onDownload={onDownload}
                testid="result-download-sources"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ArtifactChip({
  icon,
  label,
  url,
  filename,
  onDownload,
  testid,
}: {
  icon: React.ReactNode;
  label: string;
  url?: string;
  filename: string;
  onDownload: (url?: string, filename?: string) => void;
  testid: string;
}) {
  const disabled = !url;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onDownload(url, filename)}
      data-testid={testid}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors enabled:hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {icon}
      {label}
    </button>
  );
}
