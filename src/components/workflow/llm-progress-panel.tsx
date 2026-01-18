"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, Terminal, Cpu, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type LLMStatus = "idle" | "preparing" | "streaming" | "complete" | "error";

export interface LLMProgressPanelProps {
  status: LLMStatus;
  prompt?: string;
  systemPrompt?: string;
  output?: string;
  error?: string;
  provider?: string;
  model?: string;
  className?: string;
}

export function LLMProgressPanel({
  status,
  prompt,
  systemPrompt,
  output,
  error,
  provider = "Anthropic API",
  model,
  className,
}: LLMProgressPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);

  // Auto-scroll output when streaming
  useEffect(() => {
    if (status === "streaming" && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, status]);

  // Auto-expand when activity starts
  useEffect(() => {
    if (status === "preparing" || status === "streaming") {
      setIsExpanded(true);
    }
  }, [status]);

  const getStatusIcon = () => {
    switch (status) {
      case "idle":
        return <Terminal className="h-4 w-4 text-muted-foreground" />;
      case "preparing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "streaming":
        return <Cpu className="h-4 w-4 text-green-500 animate-pulse" />;
      case "complete":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "idle":
        return "Ready";
      case "preparing":
        return "Preparing request...";
      case "streaming":
        return "Receiving response...";
      case "complete":
        return "Complete";
      case "error":
        return "Error";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "idle":
        return "bg-muted";
      case "preparing":
        return "bg-blue-500/10 border-blue-500/30";
      case "streaming":
        return "bg-green-500/10 border-green-500/30";
      case "complete":
        return "bg-green-500/10 border-green-500/30";
      case "error":
        return "bg-red-500/10 border-red-500/30";
    }
  };

  if (status === "idle" && !prompt && !output) {
    return null;
  }

  return (
    <Card className={cn("overflow-hidden transition-all", getStatusColor(), className)}>
      <CardHeader
        className="py-3 px-4 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {getStatusIcon()}
            <CardTitle className="text-sm font-medium">{getStatusText()}</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{provider}</span>
            {model && (
              <>
                <span>|</span>
                <span>{model}</span>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 pb-4 px-4 space-y-4">
          {/* System Prompt (collapsible) */}
          {systemPrompt && (
            <div className="space-y-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSystemPrompt(!showSystemPrompt);
                }}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSystemPrompt ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <span>System Prompt</span>
              </button>
              {showSystemPrompt && (
                <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-auto max-h-32 whitespace-pre-wrap font-mono">
                  {systemPrompt}
                </pre>
              )}
            </div>
          )}

          {/* User Prompt */}
          {prompt && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-xs font-medium text-muted-foreground">Prompt</span>
              </div>
              <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-auto max-h-48 whitespace-pre-wrap font-mono border-l-2 border-blue-500">
                {prompt}
              </pre>
            </div>
          )}

          {/* Output */}
          {(output || status === "streaming") && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-2 w-2 rounded-full",
                  status === "streaming" ? "bg-green-500 animate-pulse" : "bg-green-500"
                )} />
                <span className="text-xs font-medium text-muted-foreground">
                  Output {status === "streaming" && <span className="text-green-500">(live)</span>}
                </span>
                {output && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {output.length} chars
                  </span>
                )}
              </div>
              <pre
                ref={outputRef}
                className={cn(
                  "text-xs bg-muted/50 p-3 rounded-md overflow-auto max-h-64 whitespace-pre-wrap font-mono border-l-2 border-green-500",
                  status === "streaming" && "animate-pulse"
                )}
              >
                {output || "Waiting for response..."}
                {status === "streaming" && <span className="inline-block w-2 h-4 bg-green-500 ml-0.5 animate-pulse" />}
              </pre>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-xs font-medium text-red-500">Error</span>
              </div>
              <pre className="text-xs bg-red-500/10 p-3 rounded-md overflow-auto max-h-32 whitespace-pre-wrap font-mono border-l-2 border-red-500 text-red-500">
                {error}
              </pre>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
