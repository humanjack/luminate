"use client";

import { useState, useEffect, useRef, use, useMemo } from "react";
import { Play, Pause, Download, Upload, Film, MonitorPlay, Captions } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StepContainer } from "@/components/workflow/step-container";
import { ExportResult } from "@/components/workflow/export-result";
import { VideoPreviewStage } from "@/components/workflow/video-preview-stage";
import { ReadinessPanel } from "@/components/workflow/readiness-panel";
import { SeoCopilotPanel } from "@/components/workflow/seo-copilot-panel";
import { ThumbnailPicker } from "@/components/workflow/thumbnail-picker";
import { ClipExtractor } from "@/components/workflow/clip-extractor";
import { useProjectStore } from "@/stores/project-store";
import { useSettingsStore } from "@/stores/settings-store";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { computeReadiness } from "@/lib/readiness";

interface PageProps {
  params: Promise<{ id: string }>;
}

type ExportStatus = "idle" | "preparing" | "processing" | "complete" | "error";

export default function VideoPage({ params }: PageProps) {
  const { id } = use(params);
  const { currentProject } = useProjectStore();
  const { defaultResolution, defaultTransition, youtubeConnected } = useSettingsStore();

  const [resolution, setResolution] = useState<string>(defaultResolution);
  const [transition, setTransition] = useState<string>(defaultTransition);
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const [exportProgress, setExportProgress] = useState(0);
  const [previewSlide, setPreviewSlide] = useState(0);
  const [showCaptions, setShowCaptions] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showYouTubeDialog, setShowYouTubeDialog] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const playbackRef = useRef<NodeJS.Timeout | null>(null);

  const slides = useMemo(() => currentProject?.slides || [], [currentProject?.slides]);
  const scripts = useMemo(() => currentProject?.scripts || [], [currentProject?.scripts]);
  const recordings = useMemo(() => currentProject?.recordings || [], [currentProject?.recordings]);
  const outlineItems = useMemo(() => currentProject?.outlineItems || [], [currentProject?.outlineItems]);
  const claims = useMemo(() => currentProject?.claims || [], [currentProject?.claims]);

  // Calculate total duration
  const totalDuration = recordings.reduce((sum, r) => sum + (r.duration || 0), 0);

  const readiness = useMemo(
    () =>
      computeReadiness({
        slides,
        scripts,
        recordings,
        outlineItems,
        claims,
      }),
    [slides, scripts, recordings, outlineItems, claims]
  );

  // Simulate video preview playback
  useEffect(() => {
    if (isPlaying) {
      playbackRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 1;
          if (next >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          // Update current slide based on time
          let elapsed = 0;
          for (let i = 0; i < recordings.length; i++) {
            elapsed += recordings[i].duration || 0;
            if (next < elapsed) {
              setPreviewSlide(i);
              break;
            }
          }
          return next;
        });
      }, 1000);
    } else if (playbackRef.current) {
      clearInterval(playbackRef.current);
    }
    return () => {
      if (playbackRef.current) clearInterval(playbackRef.current);
    };
  }, [isPlaying, totalDuration, recordings]);

  const [exportArtifacts, setExportArtifacts] = useState<{
    mp4?: string;
    captions?: string;
    transcript?: string;
    sources?: string;
  }>({});
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!readiness.canExport) {
      return;
    }
    setExportStatus("preparing");
    setExportProgress(0);
    setExportError(null);
    setExportArtifacts({});

    try {
      setExportStatus("processing");
      // Tick a small progress fake while the server is rendering so the bar
      // doesn't sit at zero. The route is synchronous; this is just UI feedback.
      const tick = setInterval(() => {
        setExportProgress((p) => Math.min(p + 3, 90));
      }, 500);

      const res = await fetch(`/api/projects/${id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      clearInterval(tick);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Export failed (${res.status})`);
      }
      const completed = await res.json();
      setExportProgress(100);
      setVideoUrl(completed.outputPath);
      setExportArtifacts({
        mp4: completed.outputPath,
        captions: completed.captionsPath,
        transcript: completed.transcriptPath,
        sources: completed.sourcesPath,
      });
      setExportStatus("complete");
    } catch (error) {
      console.error("Export failed:", error);
      setExportError((error as Error).message || "Export failed");
      setExportStatus("error");
    }
  };

  const handleDownload = (url?: string, filename?: string) => {
    const target = url || videoUrl;
    if (!target) return;
    const a = document.createElement("a");
    a.href = target;
    a.download = filename || `${currentProject?.name || "video"}.mp4`;
    a.click();
  };

  const handleYouTubeUpload = async () => {
    // In a real app, this would trigger OAuth and upload
    setShowYouTubeDialog(false);
    // Redirect to YouTube OAuth or show upload progress
    window.open("https://studio.youtube.com/channel/upload", "_blank");
  };

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  // Caption for the active slide: prefer a script matched by slide index,
  // else fall back to positional order.
  const captionText =
    scripts.find((s) => s.slideIndex === previewSlide)?.text ??
    scripts[previewSlide]?.text;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <StepContainer
        className="flex-1 min-h-0"
        title="Video Production"
        description="Preview and export your final video"
        icon="🎬"
        actions={
          <div className="flex items-center gap-2">
            {exportStatus === "complete" && (
              <>
                <Button variant="outline" onClick={() => handleDownload()}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button onClick={() => setShowYouTubeDialog(true)}>
                  <MonitorPlay className="h-4 w-4 mr-2" />
                  Upload to YouTube
                </Button>
              </>
            )}
          </div>
        }
      >
        <div className="flex-1 p-6 space-y-6">
          {exportStatus === "complete" && (
            <ExportResult
              projectName={currentProject?.name || "video"}
              posterMarkdown={slides[0]?.markdown}
              posterTheme={slides[0]?.theme}
              slideCount={slides.length}
              totalDuration={totalDuration}
              resolution={resolution}
              artifacts={exportArtifacts}
              onDownload={handleDownload}
              onUploadYouTube={() => setShowYouTubeDialog(true)}
            />
          )}
          <ReadinessPanel projectId={id} report={readiness} />
          <SeoCopilotPanel projectId={id} />
          <ThumbnailPicker projectId={id} />
          <ClipExtractor projectId={id} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Preview */}
            <div className="lg:col-span-2 space-y-4">
              <Label>Preview</Label>

              {/* Video Preview Area */}
              <VideoPreviewStage
                slides={slides}
                index={previewSlide}
                transition={transition as "none" | "fade" | "slide"}
                caption={captionText}
                showCaptions={showCaptions}
              />

              {/* Playback Controls */}
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={togglePlayback}
                    disabled={slides.length === 0}
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>

                  <div className="flex-1">
                    <Slider
                      value={[currentTime]}
                      max={totalDuration || 1}
                      step={1}
                      onValueChange={([value]) => setCurrentTime(value)}
                    />
                  </div>

                  <span className="text-sm font-mono min-w-[80px] text-right">
                    {formatDuration(currentTime)} / {formatDuration(totalDuration)}
                  </span>

                  <Button
                    variant={showCaptions ? "secondary" : "outline"}
                    size="icon"
                    onClick={() => setShowCaptions((v) => !v)}
                    aria-pressed={showCaptions}
                    title={showCaptions ? "Hide captions" : "Show captions"}
                    data-testid="toggle-captions"
                  >
                    <Captions className="h-4 w-4" />
                  </Button>
                </div>

                {/* Timeline */}
                <div className="flex gap-1 h-8">
                  {slides.map((slide, index) => {
                    const duration = recordings[index]?.duration || 0;
                    const width = totalDuration > 0 ? (duration / totalDuration) * 100 : 100 / slides.length;
                    return (
                      <button
                        key={index}
                        onClick={() => setPreviewSlide(index)}
                        className={cn(
                          "h-full rounded transition-colors relative group",
                          index === previewSlide
                            ? "bg-primary"
                            : "bg-muted hover:bg-muted/80"
                        )}
                        style={{ width: `${width}%` }}
                      >
                        <span className="absolute inset-0 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          {index + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Export Settings */}
            <div className="space-y-4">
              <Label>Export Settings</Label>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Resolution</Label>
                    <Select value={resolution} onValueChange={setResolution}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1280x720">720p (1280×720)</SelectItem>
                        <SelectItem value="1920x1080">1080p (1920×1080)</SelectItem>
                        <SelectItem value="2560x1440">1440p (2560×1440)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Transition</Label>
                    <Select value={transition} onValueChange={setTransition}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="fade">Fade</SelectItem>
                        <SelectItem value="slide">Slide</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Export Button / Progress */}
              <Card>
                <CardContent className="p-4">
                  {exportStatus === "idle" && (
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleExport}
                      disabled={!readiness.canExport}
                      data-testid="export-button"
                    >
                      <Film className="h-4 w-4 mr-2" />
                      {readiness.canExport
                        ? "Export Video"
                        : `Fix ${readiness.totals.errors} issue${
                            readiness.totals.errors === 1 ? "" : "s"
                          } to export`}
                    </Button>
                  )}

                  {(exportStatus === "preparing" || exportStatus === "processing") && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          {exportStatus === "preparing" ? "Preparing..." : "Exporting..."}
                        </span>
                        <span>{exportProgress}%</span>
                      </div>
                      <Progress value={exportProgress} />
                    </div>
                  )}

                  {exportStatus === "complete" && (
                    <div
                      data-testid="export-complete"
                      className="space-y-2 text-center"
                    >
                      <div className="flex items-center justify-center gap-2 text-emerald-600 font-medium">
                        <Film className="h-4 w-4" />
                        Export complete
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Your finished video and downloads are in the summary above.
                      </p>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleExport}
                      >
                        Re-export
                      </Button>
                    </div>
                  )}

                  {exportStatus === "error" && (
                    <div className="space-y-3" data-testid="export-error">
                      <div className="text-red-600 font-medium text-center">
                        Export failed
                      </div>
                      {exportError && (
                        <p className="text-xs text-red-600 text-center">
                          {exportError}
                        </p>
                      )}
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleExport}
                      >
                        Try again
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Project Summary */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Project Summary</CardTitle>
                </CardHeader>
                <CardContent className="py-0 pb-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Slides</span>
                    <span>{slides.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recordings</span>
                    <span>{recordings.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Duration</span>
                    <span>{formatDuration(totalDuration)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Output</span>
                    <span>{resolution}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </StepContainer>

      {/* YouTube Upload Dialog */}
      <Dialog open={showYouTubeDialog} onOpenChange={setShowYouTubeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload to YouTube</DialogTitle>
            <DialogDescription>
              Your video is ready! Would you like to upload it to YouTube?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {youtubeConnected ? (
              <p className="text-sm text-muted-foreground">
                You&apos;re connected to YouTube. Click upload to publish your video.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                You&apos;ll be redirected to YouTube Studio to upload your video manually.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowYouTubeDialog(false)}>
              Not Now
            </Button>
            <Button onClick={handleYouTubeUpload}>
              <Upload className="h-4 w-4 mr-2" />
              {youtubeConnected ? "Upload" : "Open YouTube Studio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
