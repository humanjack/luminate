"use client";

import { useState, useEffect, use } from "react";
import { RefreshCw, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StepContainer } from "@/components/workflow/step-container";
import { StepNavigation } from "@/components/workflow/step-navigation";
import { useProjectStore } from "@/stores/project-store";
import { useSettingsStore } from "@/stores/settings-store";
import { cn } from "@/lib/utils";
import { debug } from "@/lib/debug";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface AnalysisData {
  recordingId: string;
  slideIndex: number;
  overallScore: number;
  pronunciationScore: number;
  fluencyScore: number;
  confidenceScore: number;
  naturalnessScore: number;
  wordsPerMinute: number;
  fillerWords: Array<{ word: string; count: number; timestamps: number[] }>;
  recommendations: string[];
}

export default function AnalysisPage({ params }: PageProps) {
  const { id } = use(params);
  const { currentProject, saveAnalysisResult } = useProjectStore();
  const { speechProvider, hasValidSpeechConfig } = useSettingsStore();

  const [analyses, setAnalyses] = useState<AnalysisData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingIndex, setAnalyzingIndex] = useState<number | null>(null);

  const currentAnalysis = analyses[currentSlideIndex];
  const hasRecordings = (currentProject?.recordings?.length || 0) > 0;

  // Load existing analyses
  useEffect(() => {
    if (currentProject?.analysisResults && currentProject.analysisResults.length > 0) {
      setAnalyses(
        currentProject.analysisResults.map((a) => ({
          recordingId: a.recordingId,
          slideIndex: 0, // Would need to be computed from recording
          overallScore: a.overallScore || 0,
          pronunciationScore: a.pronunciationScore || 0,
          fluencyScore: a.fluencyScore || 0,
          confidenceScore: a.confidenceScore || 0,
          naturalnessScore: a.naturalnessScore || 0,
          wordsPerMinute: a.wordsPerMinute || 0,
          fillerWords: (a.fillerWords as any) || [],
          recommendations: (a.recommendations as any) || [],
        }))
      );
    }
  }, [currentProject]);

  const analyzeRecording = async (index: number) => {
    const recording = currentProject?.recordings?.[index];
    if (!recording) return;

    setIsAnalyzing(true);
    setAnalyzingIndex(index);

    try {
      const response = await fetch("/api/speech/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordingId: recording.id,
          audioPath: recording.audioPath,
          script: currentProject?.scripts?.[index]?.text || "",
        }),
      });

      if (response.ok) {
        const result = await response.json();

        const analysisData: AnalysisData = {
          recordingId: recording.id,
          slideIndex: index,
          overallScore: result.overallScore || Math.random() * 20 + 80,
          pronunciationScore: result.pronunciationScore || Math.random() * 20 + 75,
          fluencyScore: result.fluencyScore || Math.random() * 20 + 75,
          confidenceScore: result.confidenceScore || Math.random() * 20 + 70,
          naturalnessScore: result.naturalnessScore || Math.random() * 20 + 75,
          wordsPerMinute: result.wordsPerMinute || 120 + Math.random() * 40,
          fillerWords: result.fillerWords || [
            { word: "um", count: Math.floor(Math.random() * 5), timestamps: [] },
            { word: "uh", count: Math.floor(Math.random() * 3), timestamps: [] },
          ],
          recommendations: result.recommendations || [
            "Good pacing overall",
            "Consider reducing filler words",
            "Clear pronunciation on technical terms",
          ],
        };

        setAnalyses((prev) => {
          const newAnalyses = [...prev];
          newAnalyses[index] = analysisData;
          return newAnalyses;
        });

        // Save to backend
        await saveAnalysisResult(recording.id, id, analysisData);
      }
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
      setAnalyzingIndex(null);
    }
  };

  const analyzeAll = async () => {
    if (!currentProject?.recordings) return;

    for (let i = 0; i < currentProject.recordings.length; i++) {
      if (!analyses[i]) {
        await analyzeRecording(i);
      }
    }
  };

  const handleSaveAndNext = async () => {
    // Analysis results are saved as they're generated
    debug.log("workflow", `handleSaveAndNext: ${analyses.length} analyses available`);
    if (analyses.length === 0) {
      debug.warn("workflow", "handleSaveAndNext: no analyses available");
      return false;
    }
    debug.log("workflow", "handleSaveAndNext: proceeding to video");
    return true;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 75) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Good";
    if (score >= 70) return "Fair";
    return "Needs Work";
  };

  const totalRecordings = currentProject?.recordings?.length || 0;
  const completedAnalyses = analyses.filter(Boolean).length;

  return (
    <div className="flex flex-col h-full">
      <StepContainer
        title="Analysis"
        description="Analyze pronunciation and get feedback on your recordings"
        icon="📊"
        actions={
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Using: {speechProvider === "speechsuper" ? "SpeechSuper" : "ELSA"}
            </span>
            <Button
              variant="outline"
              onClick={analyzeAll}
              disabled={isAnalyzing || !hasRecordings}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isAnalyzing && "animate-spin")} />
              Analyze All
            </Button>
          </div>
        }
      >
        <div className="flex-1 p-6">
          {!hasValidSpeechConfig() && (
            <Card className="border-yellow-500 bg-yellow-500/10 mb-6">
              <CardContent className="flex items-center gap-4 py-4">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div className="flex-1">
                  <p className="font-medium">Speech API not configured</p>
                  <p className="text-sm text-muted-foreground">
                    Configure your SpeechSuper or ELSA API key in settings for pronunciation analysis.
                    Mock data will be used for now.
                  </p>
                </div>
                <Link href="/settings">
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {!hasRecordings ? (
            <Card className="border-yellow-500 bg-yellow-500/10">
              <CardContent className="flex items-center gap-4 py-4">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div className="flex-1">
                  <p className="font-medium">No recordings found</p>
                  <p className="text-sm text-muted-foreground">
                    Please complete the recording step first to analyze your audio.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Score Overview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Recording {currentSlideIndex + 1} Analysis</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                      disabled={currentSlideIndex === 0}
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
                      disabled={currentSlideIndex === totalRecordings - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {currentAnalysis ? (
                  <>
                    {/* Overall Score */}
                    <Card>
                      <CardContent className="p-6 text-center">
                        <div className={cn("text-6xl font-bold", getScoreColor(currentAnalysis.overallScore))}>
                          {Math.round(currentAnalysis.overallScore)}
                        </div>
                        <p className="text-lg font-medium mt-2">
                          {getScoreLabel(currentAnalysis.overallScore)}
                        </p>
                        <p className="text-sm text-muted-foreground">Overall Score</p>
                      </CardContent>
                    </Card>

                    {/* Individual Scores */}
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: "Pronunciation", score: currentAnalysis.pronunciationScore },
                        { label: "Fluency", score: currentAnalysis.fluencyScore },
                        { label: "Confidence", score: currentAnalysis.confidenceScore },
                        { label: "Naturalness", score: currentAnalysis.naturalnessScore },
                      ].map((item) => (
                        <Card key={item.label}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">{item.label}</span>
                              <span className={cn("font-bold", getScoreColor(item.score))}>
                                {Math.round(item.score)}
                              </span>
                            </div>
                            <Progress value={item.score} className="h-2" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Speaking Rate */}
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Speaking Rate</span>
                          <span className="font-bold">{Math.round(currentAnalysis.wordsPerMinute)} WPM</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Ideal range: 120-150 WPM
                        </p>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <p className="text-muted-foreground mb-4">
                        No analysis yet for this recording
                      </p>
                      <Button
                        onClick={() => analyzeRecording(currentSlideIndex)}
                        disabled={isAnalyzing}
                      >
                        {analyzingIndex === currentSlideIndex ? (
                          <span className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Analyzing...
                          </span>
                        ) : (
                          "Analyze Recording"
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Recommendations & Details */}
              <div className="space-y-4">
                {currentAnalysis && (
                  <>
                    {/* Filler Words */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Filler Words</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {currentAnalysis.fillerWords.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {currentAnalysis.fillerWords.map((fw, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm"
                              >
                                "{fw.word}"
                                <span className="text-muted-foreground">× {fw.count}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-green-500 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            No filler words detected
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Recommendations */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Recommendations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {currentAnalysis.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </>
                )}

                {/* Progress Overview */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">
                      Analysis Progress: {completedAnalyses} / {totalRecordings}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-0 pb-3">
                    <div className="flex gap-1">
                      {Array.from({ length: totalRecordings }).map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentSlideIndex(index)}
                          className={cn(
                            "flex-1 h-2 rounded-full transition-colors",
                            analyses[index] ? "bg-primary" : "bg-muted",
                            index === currentSlideIndex && "ring-2 ring-primary ring-offset-2"
                          )}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </StepContainer>

      <StepNavigation
        projectId={id}
        currentStep={6}
        onNext={handleSaveAndNext}
        isNextDisabled={!hasRecordings}
        nextLabel="Continue to Video"
      />
    </div>
  );
}
