"use client";

import { useState, useEffect, useRef, use } from "react";
import { Mic, Square, Play, Pause, Trash2, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
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
  audioBlob?: Blob;
  audioUrl?: string;
  duration: number;
}

export default function RecordingPage({ params }: PageProps) {
  const { id } = use(params);
  const { currentProject, saveRecording } = useProjectStore();
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

  // Initialize recordings array
  useEffect(() => {
    if (currentProject?.scripts) {
      setRecordings(
        currentProject.scripts.map((_, index) => ({
          slideIndex: index,
          duration: 0,
        }))
      );
    }
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

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);

        setRecordings((prev) =>
          prev.map((rec, i) =>
            i === currentSlideIndex
              ? { ...rec, audioBlob: blob, audioUrl: url, duration: recordingTime }
              : rec
          )
        );

        stream.getTracks().forEach((track) => track.stop());
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

  const deleteRecording = () => {
    if (currentRecording?.audioUrl) {
      URL.revokeObjectURL(currentRecording.audioUrl);
    }
    setRecordings((prev) =>
      prev.map((rec, i) =>
        i === currentSlideIndex
          ? { slideIndex: i, duration: 0 }
          : rec
      )
    );
  };

  const handleSaveAndNext = async () => {
    const completedRecordings = recordings.filter((r) => r.audioBlob);
    if (completedRecordings.length === 0) {
      debug.warn("workflow", "handleSaveAndNext: no recordings to save");
      return false;
    }

    debug.log("workflow", `handleSaveAndNext: saving ${completedRecordings.length} recordings...`);

    try {
      // Save each recording
      for (const recording of completedRecordings) {
        if (recording.audioBlob) {
          const reader = new FileReader();
          const audioData = await new Promise<string>((resolve) => {
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(",")[1];
              resolve(base64);
            };
            reader.readAsDataURL(recording.audioBlob!);
          });

          await saveRecording(id, {
            slideIndex: recording.slideIndex,
            slideId: currentProject?.scripts?.[recording.slideIndex]?.slideId || undefined,
            audioPath: "", // Will be set by the server
            duration: recording.duration,
          });
        }
      }

      debug.log("workflow", "handleSaveAndNext: recordings saved successfully");
      return true;
    } catch (error) {
      debug.error("workflow", `handleSaveAndNext failed: ${(error as Error).message}`);
      return false;
    }
  };

  const completedRecordings = recordings.filter((r) => r.audioBlob).length;
  const totalRecordings = recordings.length;

  return (
    <div className="flex flex-col h-full">
      <StepContainer
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
                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Recording ({formatDuration(currentRecording.duration)})
                        </span>
                        <div className="flex gap-2">
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
                            onClick={deleteRecording}
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
                    Progress: {completedRecordings} / {totalRecordings} recordings
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
                          rec.audioBlob ? "bg-primary" : "bg-muted",
                          index === currentSlideIndex && "ring-2 ring-primary ring-offset-2"
                        )}
                        disabled={isRecording}
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
