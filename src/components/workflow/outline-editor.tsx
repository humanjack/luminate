"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { OutlineItem, Claim } from "@/lib/db/schema";

export interface DraftOutlineItem {
  id?: string;
  index: number;
  title: string;
  summary: string;
  speakerGoal: string;
  claimIds: string[];
  approved: boolean;
}

export interface OutlineEditorProps {
  initial: OutlineItem[];
  claims?: Claim[];
  /** Markdown source we can seed the outline from if `initial` is empty */
  fallbackMarkdown?: string;
  onSave: (items: DraftOutlineItem[]) => Promise<void>;
  saving?: boolean;
  saveError?: string | null;
}

export function seedFromMarkdown(markdown: string): DraftOutlineItem[] {
  if (!markdown.trim()) return [];
  const sections = markdown.split(/\n---\n/).filter((s) => s.trim());
  return sections.map((section, index) => {
    const lines = section.trim().split("\n");
    const titleLine = lines.find((l) => /^#{1,3}\s+/.test(l)) || "";
    const title = titleLine.replace(/^#+\s*/, "").trim() || `Section ${index + 1}`;
    const bullets = lines
      .filter((l) => /^[-*]\s+/.test(l))
      .map((l) => l.replace(/^[-*]\s+/, "").trim())
      .filter(Boolean);
    return {
      index,
      title,
      summary: bullets.slice(0, 3).join("\n"),
      speakerGoal: "",
      claimIds: [],
      approved: false,
    };
  });
}

export function OutlineEditor({
  initial,
  claims = [],
  fallbackMarkdown,
  onSave,
  saving = false,
  saveError,
}: OutlineEditorProps) {
  const [items, setItems] = useState<DraftOutlineItem[]>([]);

  useEffect(() => {
    if (initial.length > 0) {
      setItems(
        initial.map((it) => ({
          id: it.id,
          index: it.index,
          title: it.title,
          summary: it.summary ?? "",
          speakerGoal: it.speakerGoal ?? "",
          claimIds: it.claimIds ?? [],
          approved: !!it.approved,
        }))
      );
    } else if (fallbackMarkdown) {
      setItems(seedFromMarkdown(fallbackMarkdown));
    }
  }, [initial, fallbackMarkdown]);

  function update(index: number, patch: Partial<DraftOutlineItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it))
    );
  }

  function move(from: number, to: number) {
    setItems((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [taken] = next.splice(from, 1);
      next.splice(to, 0, taken);
      return next.map((it, i) => ({ ...it, index: i }));
    });
  }

  function remove(index: number) {
    setItems((prev) =>
      prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, index: i }))
    );
  }

  function add() {
    setItems((prev) => [
      ...prev,
      {
        index: prev.length,
        title: "New section",
        summary: "",
        speakerGoal: "",
        claimIds: [],
        approved: false,
      },
    ]);
  }

  function toggleApprove(index: number) {
    update(index, { approved: !items[index].approved });
  }

  function approveAll() {
    setItems((prev) => prev.map((it) => ({ ...it, approved: true })));
  }

  async function handleSave() {
    await onSave(items);
  }

  const approvedCount = items.filter((it) => it.approved).length;
  const allApproved = items.length > 0 && approvedCount === items.length;
  const unsupportedCount = claims.length
    ? items.filter((it) => it.claimIds.length === 0).length
    : 0;

  return (
    <Card data-testid="outline-editor">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
        <div>
          <CardTitle className="text-base">Story outline</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Edit, reorder, and approve each item before generating slides.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span
            data-testid="approval-progress"
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              allApproved
                ? "bg-emerald-100 text-emerald-700"
                : "bg-muted text-muted-foreground"
            )}
          >
            {approvedCount} / {items.length} approved
          </span>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={approveAll} disabled={allApproved}>
              Approve all
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No outline yet. Generate content above, or add a section manually.
          </p>
        ) : (
          items.map((it, i) => (
            <div
              key={it.id ?? `new-${i}`}
              data-testid="outline-item"
              className={cn(
                "rounded-md border p-3 space-y-2 transition-colors",
                it.approved
                  ? "border-emerald-300 bg-emerald-50/40"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground w-6 text-center">
                  {i + 1}
                </span>
                <Input
                  value={it.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  className="font-medium"
                  aria-label={`Outline item ${i + 1} title`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Move item ${i + 1} up`}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => move(i, i + 1)}
                  disabled={i === items.length - 1}
                  aria-label={`Move item ${i + 1} down`}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(i)}
                  aria-label={`Delete item ${i + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={it.approved ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleApprove(i)}
                  data-testid={`approve-${i}`}
                >
                  {it.approved ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Approved
                    </>
                  ) : (
                    "Approve"
                  )}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Summary</Label>
                  <Textarea
                    rows={3}
                    placeholder="What this section covers"
                    value={it.summary}
                    onChange={(e) => update(i, { summary: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Speaker goal</Label>
                  <Textarea
                    rows={3}
                    placeholder="What the viewer should walk away with"
                    value={it.speakerGoal}
                    onChange={(e) => update(i, { speakerGoal: e.target.value })}
                  />
                </div>
              </div>
              {claims.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-1">
                    Supporting claims:
                  </span>
                  {claims.map((claim) => {
                    const linked = it.claimIds.includes(claim.id);
                    return (
                      <button
                        type="button"
                        key={claim.id}
                        onClick={() =>
                          update(i, {
                            claimIds: linked
                              ? it.claimIds.filter((id) => id !== claim.id)
                              : [...it.claimIds, claim.id],
                          })
                        }
                        className={cn(
                          "text-xs rounded-full border px-2 py-0.5",
                          linked
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-muted text-muted-foreground border-transparent"
                        )}
                      >
                        {claim.text.length > 64
                          ? `${claim.text.slice(0, 60)}…`
                          : claim.text}
                      </button>
                    );
                  })}
                  {it.claimIds.length === 0 && (
                    <span className="text-xs text-amber-700 inline-flex items-center gap-1 ml-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Unsupported
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        <div className="flex items-center justify-between pt-2">
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="h-4 w-4 mr-1" />
            Add section
          </Button>
          <div className="flex items-center gap-3">
            {unsupportedCount > 0 && (
              <span className="text-xs text-amber-700 inline-flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {unsupportedCount} unsupported item{unsupportedCount > 1 ? "s" : ""}
              </span>
            )}
            {saveError && (
              <span className="text-xs text-red-600">{saveError}</span>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving || items.length === 0}
              data-testid="save-outline"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save outline"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
