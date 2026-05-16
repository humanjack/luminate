"use client";

import { useState, useEffect, useRef, use } from "react";
import { Mic, Square, Play, Pause, Trash2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StepContainer } from "@/components/workflow/step-container";
import { StepNavigation } from "@/components/workflow/step-navigation";
import { useProjectStore } from "@/stores/project-store";
import { useSettingsStore } from "@/stores/settings-store";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { debug } from "@/lib/debug";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface RecordingData {
  slideIndex: number;
  recordingId?: string;
  audioUrl?: string;
  duration: number;
  saved: boolean;
  saving?: boolean;
  error?: string;
}

export default function RecordingPage({ params }: PageProps) {
  const { id } = use(params);
  const { currentProject, saveRecording, deleteRecording } = useProjectStore();
  const { teleprompterSpeed, teleprompterFontSize, showWaveform, defaultRecordingMode } = useSettingsStore();

  const [recordings, setRecordings] = useState<RecordingData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [teleprompterActive, setTeleprompterActive] = useState(false);
  const [teleprompterPosition, setTeleprompterPosition] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const teleprompterRef = useRef<HTMLDivElement | null>(null);

  const currentScript = currentProject?.scripts?.[currentSlideIndex];
  const currentRecording = recordings[currentSlideIndex];

  // Hydrate recordings from saved DB rows so refresh keeps audio
  useEffect(() => {
    if (!currentProject?.scripts) return;
    const saved = currentProject.recordings ?? [];
    const bySlide = new Map<number, typeof saved[number]>();
    for (const r of saved) {
      if (typeof r.slideIndex === "number") bySlide.set(r.slideIndex, r);
    }
    setRecordings(
      currentProject.scripts.map((_, index) => {
        const r = bySlide.get(index);
        if (r?.audioPath) {
          return {
            slideIndex: index,
            recordingId: r.id,
            audioUrl: r.audioPath,
            duration: r.duration ?? 0,
            saved: true,
          };
        }
        return { slideIndex: index, duration: 0, saved: false };
      })
    );
  }, [currentProject]);

  // Audio level monitoring
  useEffect(() => {
    if (isRecording && !isPaused && analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(average / 255);
        if (isRecording && !isPaused) {
          requestAnimationFrame(updateLevel);
        }
      };
      updateLevel();
    }
  }, [isRecording, isPaused]);

  // Teleprompter scrolling
  useEffect(() => {
    if (teleprompterActive && isRecording && !isPaused && teleprompterRef.current) {
      const scrollInterval = setInterval(() => {
        setTeleprompterPosition((prev) => {
          const maxScroll = teleprompterRef.current!.scrollHeight - teleprompterRef.current!.clientHeight;
          const newPosition = Math.min(prev + 1, maxScroll);
          teleprompterRef.current!.scrollTop = newPosition;
          return newPosition;
        });
      }, 60000 / teleprompterSpeed / 10); // Adjust based on WPM

      return () => clearInterval(scrollInterval);
    }
  }, [teleprompterActive, isRecording, isPaused, teleprompterSpeed]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio analysis
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // Set up MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const localUrl = URL.createObjectURL(blob);
        const slideIdx = currentSlideIndex;
        const takeDuration = recordingTime;

        setRecordings((prev) =>
          prev.map((rec, i) =>
            i === slideIdx
              ? {
                  slideIndex: i,
                  audioUrl: localUrl,
                  duration: takeDuration,
                  saved: false,
                  saving: true,
                  error: undefined,
                }
              : rec
          )
        );

        stream.getTracks().forEach((track) => track.stop());

        // Persist audio bytes to the server immediately so re-records and
        // refreshes get the durable path.
        try {
          const base64 = await blobToBase64(blob);
          const saved = await saveRecording(id, {
            slideIndex: slideIdx,
            slideId: currentProject?.scripts?.[slideIdx]?.slideId || undefined,
            audioPath: "",
            duration: takeDuration,
            // @ts-expect-error audioData is forwarded to the API but isn't on the DB type
            audioData: base64,
          });
          setRecordings((prev) =>
            prev.map((rec, i) =>
              i === slideIdx
                ? {
                    slideIndex: i,
                    recordingId: saved.id,
                    audioUrl: saved.audioPath || localUrl,
                    duration: saved.duration ?? takeDuration,
                    saved: true,
                  }
                : rec
            )
          );
        } catch (err) {
          debug.error("workflow", `save recording failed: ${(err as Error).message}`);
          setRecordings((prev) =>
            prev.map((rec, i) =>
              i === slideIdx
                ? {
                    ...rec,
                    saving: false,
                    error: (err as Error).message || "Failed to save recording",
                  }
                : rec
            )
          );
        }
      };

      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      setTeleprompterPosition(0);
      if (teleprompterRef.current) {
        teleprompterRef.current.scrollTop = 0;
      }

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      }
      setIsPaused(!isPaused);
    }
  };

  const playRecording = () => {
    if (currentRecording?.audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(currentRecording.audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const handleDeleteRecording = async () => {
    const target = currentRecording;
    if (!target) return;
    // Revoke the object URL only when it was a blob: URL (a saved recording
    // uses /recordings/... which we must keep as a regular path).
    if (target.audioUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(target.audioUrl);
    }
    if (target.recordingId) {
      try {
        await deleteRecording(target.recordingId);
      } catch (err) {
        debug.error("workflow", `delete recording failed: ${(err as Error).message}`);
      }
    }
    setRecordings((prev) =>
      prev.map((rec, i) =>
        i === currentSlideIndex
          ? { slideIndex: i, duration: 0, saved: false }
          : rec
      )
    );
  };

  const handleSaveAndNext = async () => {
    const completed = recordings.filter((r) => r.saved);
    if (completed.length === 0) {
      debug.warn("workflow", "handleSaveAndNext: no saved recordings");
      return false;
    }
    return true;
  };

  const completedRecordings = recordings.filter((r) => r.saved).length;
  const savingCount = recordings.filter((r) => r.saving).length;
  const totalRecordings = recordings.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <StepContainer
        className="flex-1 min-h-0"
        title="Recording"
        description="Record your video narration using the teleprompter"
        icon="🎙️"
        actions={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={teleprompterActive}
                onCheckedChange={setTeleprompterActive}
              />
              <Label>Auto-scroll teleprompter</Label>
            </div>
          </div>
        }
      >
        <div className="flex-1 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Teleprompter */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Teleprompter - Slide {currentSlideIndex + 1}</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                    disabled={currentSlideIndex === 0 || isRecording}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[60px] text-center">
                    {currentSlideIndex + 1} / {totalRecordings}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentSlideIndex(Math.min(totalRecordings - 1, currentSlideIndex + 1))}
                    disabled={currentSlideIndex === totalRecordings - 1 || isRecording}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Card className="h-[400px] overflow-hidden">
                <ScrollArea className="h-full" ref={teleprompterRef}>
                  <CardContent
                    className="p-8"
                    style={{ fontSize: `${teleprompterFontSize}px` }}
                  >
                    {currentScript?.text ? (
                      <p className="leading-relaxed whitespace-pre-wrap">
                        {currentScript.text}
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-center py-12">
                        No script for this slide
                      </p>
                    )}
                  </CardContent>
                </ScrollArea>
              </Card>

              {/* Audio Level Meter */}
              {showWaveform && (
                <div className="space-y-2">
                  <Label>Audio Level</Label>
                  <div className="h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-100",
                        audioLevel > 0.8 ? "bg-red-500" :
                        audioLevel > 0.5 ? "bg-yellow-500" : "bg-green-500"
                      )}
                      style={{ width: `${audioLevel * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Recording Controls */}
            <div className="space-y-4">
              <Label>Recording Controls</Label>

              <Card>
                <CardContent className="p-6 space-y-6">
                  {/* Timer */}
                  <div className="text-center">
                    <div className="text-5xl font-mono font-bold">
                      {formatDuration(recordingTime)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {isRecording ? (isPaused ? "Paused" : "Recording...") : "Ready"}
                    </p>
                  </div>

                  {/* Recording Buttons */}
                  <div className="flex justify-center gap-4">
                    {!isRecording ? (
                      <Button
                        size="lg"
                        onClick={startRecording}
                        disabled={!currentScript?.text}
                        className="w-32"
                      >
                        <Mic className="h-5 w-5 mr-2" />
                        Record
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={pauseRecording}
                          className="w-24"
                        >
                          {isPaused ? (
                            <>
                              <Play className="h-5 w-5 mr-2" />
                              Resume
                            </>
                          ) : (
                            <>
                              <Pause className="h-5 w-5 mr-2" />
                              Pause
                            </>
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          size="lg"
                          onClick={stopRecording}
                          className="w-24"
                        >
                          <Square className="h-5 w-5 mr-2" />
                          Stop
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Playback */}
                  {currentRecording?.audioUrl && (
                    <div className="border-t pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Recording ({formatDuration(currentRecording.duration)})
                        </span>
                        <div className="flex items-center gap-2">
                          {currentRecording.saving ? (
                            <span
                              data-testid="recording-saving"
                              className="text-xs text-muted-foreground inline-flex items-center gap-1"
                            >
                              <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                              Saving…
                            </span>
                          ) : currentRecording.saved ? (
                            <span
                              data-testid="recording-saved"
                              className="text-xs text-emerald-600 inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Saved
                            </span>
                          ) : currentRecording.error ? (
                            <span
                              data-testid="recording-error"
                              className="text-xs text-red-600 inline-flex items-center gap-1"
                            >
                              <AlertCircle className="h-3.5 w-3.5" />
                              {currentRecording.error}
                            </span>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={isPlaying ? stopPlayback : playRecording}
                          >
                            {isPlaying ? (
                              <>
                                <Square className="h-4 w-4 mr-1" />
                                Stop
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-1" />
                                Play
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDeleteRecording}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Progress */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">
                    Progress: {completedRecordings} / {totalRecordings} saved
                    {savingCount > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({savingCount} saving…)
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-0 pb-3">
                  <div className="flex gap-1">
                    {recordings.map((rec, index) => (
                      <button
                        key={index}
                        onClick={() => !isRecording && setCurrentSlideIndex(index)}
                        className={cn(
                          "flex-1 h-2 rounded-full transition-colors",
                          rec.saved
                            ? "bg-primary"
                            : rec.saving
                            ? "bg-yellow-400"
                            : rec.error
                            ? "bg-red-500"
                            : "bg-muted",
                          index === currentSlideIndex && "ring-2 ring-primary ring-offset-2"
                        )}
                        disabled={isRecording}
                        aria-label={`Slide ${index + 1} ${
                          rec.saved
                            ? "saved"
                            : rec.saving
                            ? "saving"
                            : rec.error
                            ? "error"
                            : "empty"
                        }`}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </StepContainer>

      <StepNavigation
        projectId={id}
        currentStep={5}
        onNext={handleSaveAndNext}
        isNextDisabled={completedRecordings === 0}
        nextLabel="Continue to Analysis"
      />
    </div>
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
