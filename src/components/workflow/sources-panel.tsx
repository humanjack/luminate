"use client";

import { useState } from "react";
import { Link as LinkIcon, FileText, Trash2, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Source, Claim } from "@/lib/db/schema";

export interface SourcesPanelProps {
  projectId: string;
  sources: Source[];
  claims: Claim[];
  onChange: () => Promise<void> | void;
}

export function SourcesPanel({
  projectId,
  sources,
  claims,
  onChange,
}: SourcesPanelProps) {
  const [activeTab, setActiveTab] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addUrl() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "url", url: url.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to add source");
      setUrl("");
      await onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addText() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "text",
          fetchedText: text.trim(),
          title: pasteTitle.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to add source");
      setText("");
      setPasteTitle("");
      await onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeSource(id: string) {
    await fetch(`/api/sources/${id}`, { method: "DELETE" });
    await onChange();
  }

  const unsupportedClaims = claims.filter((c) => c.sourceIds.length === 0);

  return (
    <Card data-testid="sources-panel">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Sources</h3>
            <p className="text-xs text-muted-foreground">
              Add URLs or pasted text the research should cite.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              data-testid="source-count"
              className="rounded-full bg-muted px-2 py-0.5"
            >
              {sources.length} source{sources.length === 1 ? "" : "s"}
            </span>
            {unsupportedClaims.length > 0 && (
              <span
                data-testid="unsupported-claim-count"
                className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 inline-flex items-center gap-1"
              >
                <AlertCircle className="h-3 w-3" />
                {unsupportedClaims.length} unsupported
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab("url")}
            className={cn(
              "rounded-md px-2 py-1",
              activeTab === "url"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
            data-testid="tab-url"
          >
            <LinkIcon className="h-3.5 w-3.5 inline mr-1" /> URL
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("text")}
            className={cn(
              "rounded-md px-2 py-1",
              activeTab === "text"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
            data-testid="tab-text"
          >
            <FileText className="h-3.5 w-3.5 inline mr-1" /> Pasted text
          </button>
        </div>

        {activeTab === "url" ? (
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid="source-url-input"
            />
            <Button
              type="button"
              onClick={addUrl}
              disabled={busy || !url.trim()}
              data-testid="source-url-add"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add URL"}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              placeholder="Source title (optional)"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
            />
            <Textarea
              rows={3}
              placeholder="Paste source text here…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              data-testid="source-text-input"
            />
            <Button
              type="button"
              size="sm"
              onClick={addText}
              disabled={busy || !text.trim()}
              data-testid="source-text-add"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add pasted source"}
            </Button>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600" data-testid="source-error">
            {error}
          </p>
        )}

        {sources.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs">Saved sources</Label>
            <ul className="space-y-2" data-testid="source-list">
              {sources.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start gap-2 rounded-md border p-2 text-sm"
                >
                  <span className="mt-0.5">
                    {s.status === "fetched" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : s.status === "failed" ? (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {s.title || s.url || "Untitled source"}
                    </div>
                    {s.url && (
                      <div className="text-xs text-muted-foreground truncate">
                        {s.url}
                      </div>
                    )}
                    {s.type === "text" && s.fetchedText && (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {s.fetchedText.slice(0, 200)}…
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSource(s.id)}
                    aria-label={`Remove source ${s.title || s.url}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {claims.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs">Extracted claims</Label>
            <ul className="space-y-1" data-testid="claim-list">
              {claims.map((c) => {
                const sup = c.sourceIds.length > 0;
                return (
                  <li
                    key={c.id}
                    className={cn(
                      "text-sm rounded-md border px-2 py-1 flex items-start gap-2",
                      sup
                        ? "bg-emerald-50/40 border-emerald-200"
                        : "bg-amber-50/40 border-amber-200"
                    )}
                  >
                    {sup ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                    )}
                    <span>
                      {c.text}
                      {!sup && (
                        <span
                          data-testid="unsupported-claim-marker"
                          className="ml-2 text-xs uppercase tracking-wide text-amber-700"
                        >
                          Unsupported
                        </span>
                      )}
                      {sup && (
                        <span className="ml-2 text-xs text-emerald-700">
                          ({c.sourceIds.length} source
                          {c.sourceIds.length === 1 ? "" : "s"})
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
