"use client";

import { useState, useEffect, useRef, use } from "react";
import { Play, Pause, Download, Upload, ChevronLeft, ChevronRight, Film, Youtube } from "lucide-react";
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
import { useProjectStore } from "@/stores/project-store";
import { useSettingsStore } from "@/stores/settings-store";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

type ExportStatus = "idle" | "preparing" | "processing" | "complete" | "error";

export default function VideoPage({ params }: PageProps) {
  const { id } = use(params);
  const { currentProject, saveVideo, updateVideoProgress } = useProjectStore();
  const { defaultResolution, defaultTransition, youtubeConnected } = useSettingsStore();

  const [resolution, setResolution] = useState<string>(defaultResolution);
  const [transition, setTransition] = useState<string>(defaultTransition);
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const [exportProgress, setExportProgress] = useState(0);
  const [previewSlide, setPreviewSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showYouTubeDialog, setShowYouTubeDialog] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const playbackRef = useRef<NodeJS.Timeout | null>(null);

  const slides = currentProject?.slides || [];
  const scripts = currentProject?.scripts || [];
  const recordings = currentProject?.recordings || [];

  // Calculate total duration
  const totalDuration = recordings.reduce((sum, r) => sum + (r.duration || 0), 0);

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

  const handleExport = async () => {
    setExportStatus("preparing");
    setExportProgress(0);

    try {
      // Initialize video in database
      await saveVideo(id, {
        resolution,
        status: "processing",
        progress: 0,
      });

      setExportStatus("processing");

      // Simulate export progress (in a real app, this would use FFmpeg.wasm)
      for (let i = 0; i <= 100; i += 5) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        setExportProgress(i);
        await updateVideoProgress(id, i, "processing");
      }

      // Create a mock video URL (in production, this would be the actual video)
      const mockVideoUrl = URL.createObjectURL(new Blob(["mock video data"], { type: "video/mp4" }));
      setVideoUrl(mockVideoUrl);

      await updateVideoProgress(id, 100, "completed");
      setExportStatus("complete");

      // Show YouTube upload dialog
      setShowYouTubeDialog(true);
    } catch (error) {
      console.error("Export failed:", error);
      setExportStatus("error");
      await updateVideoProgress(id, 0, "failed");
    }
  };

  const handleDownload = () => {
    if (videoUrl) {
      const a = document.createElement("a");
      a.href = videoUrl;
      a.download = `${currentProject?.name || "video"}.mp4`;
      a.click();
    }
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

  // Simple slide preview renderer
  const renderSlidePreview = (markdown: string) => {
    return (
      <div
        className="w-full h-full p-8 flex flex-col justify-center bg-gradient-to-br from-primary/10 to-primary/5"
        dangerouslySetInnerHTML={{
          __html: markdown
            .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mb-4">$1</h1>')
            .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-semibold mb-3">$1</h2>')
            .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/<!--[\s\S]*?-->/g, "")
            .replace(/\n/g, "<br />"),
        }}
      />
    );
  };

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
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button onClick={() => setShowYouTubeDialog(true)}>
                  <Youtube className="h-4 w-4 mr-2" />
                  Upload to YouTube
                </Button>
              </>
            )}
          </div>
        }
      >
        <div className="flex-1 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Preview */}
            <div className="lg:col-span-2 space-y-4">
              <Label>Preview</Label>

              {/* Video Preview Area */}
              <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                {slides[previewSlide] ? (
                  <div className="w-full h-full">
                    {renderSlidePreview(slides[previewSlide].markdown)}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    No slides to preview
                  </div>
                )}

                {/* Slide indicator */}
                <div className="absolute top-4 right-4 bg-black/50 px-2 py-1 rounded text-white text-sm">
                  Slide {previewSlide + 1} / {slides.length}
                </div>
              </div>

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
                      disabled={slides.length === 0 || recordings.length === 0}
                    >
                      <Film className="h-4 w-4 mr-2" />
                      Export Video
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
                    <div className="text-center space-y-3">
                      <div className="text-green-500 font-medium">
                        Export Complete!
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={handleDownload}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={() => setShowYouTubeDialog(true)}
                        >
                          <Youtube className="h-4 w-4 mr-2" />
                          YouTube
                        </Button>
                      </div>
                    </div>
                  )}

                  {exportStatus === "error" && (
                    <div className="space-y-3">
                      <div className="text-red-500 font-medium text-center">
                        Export Failed
                      </div>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleExport}
                      >
                        Try Again
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
                You're connected to YouTube. Click upload to publish your video.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                You'll be redirected to YouTube Studio to upload your video manually.
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
