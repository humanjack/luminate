import { describe, it, expect } from "vitest";
import { computeReadiness } from "@/lib/readiness";
import type {
  Slide,
  Script,
  Recording,
  OutlineItem,
  Claim,
} from "@/lib/db/schema";

const now = new Date();

function slide(i: number, markdown = `# Slide ${i + 1}`): Slide {
  return {
    id: `slide-${i}`,
    projectId: "p1",
    index: i,
    markdown,
    imageData: null,
    theme: "default",
    sourceRefs: null,
    outlineItemId: null,
    createdAt: now,
    updatedAt: now,
  };
}
function script(i: number, text = "Some script.", estimatedDuration = 15): Script {
  return {
    id: `script-${i}`,
    projectId: "p1",
    slideId: `slide-${i}`,
    slideIndex: i,
    text,
    speakerNotes: null,
    estimatedDuration,
    sourceRefs: null,
    createdAt: now,
    updatedAt: now,
  };
}
function recording(i: number, duration = 15, audioPath = "/recordings/p1/r.webm"): Recording {
  return {
    id: `rec-${i}`,
    projectId: "p1",
    slideId: `slide-${i}`,
    slideIndex: i,
    audioPath,
    audioData: null,
    duration,
    waveformData: null,
    createdAt: now,
  };
}
function outline(i: number, approved: boolean): OutlineItem {
  return {
    id: `oi-${i}`,
    projectId: "p1",
    index: i,
    title: `Item ${i}`,
    summary: null,
    speakerGoal: null,
    claimIds: [],
    approved,
    createdAt: now,
    updatedAt: now,
  };
}
function claim(id: string, sourceIds: string[] = []): Claim {
  return {
    id,
    projectId: "p1",
    text: "x",
    sourceIds,
    pinned: false,
    status: "proposed",
    createdAt: now,
    updatedAt: now,
  };
}

describe("computeReadiness (#6)", () => {
  it("returns canExport=false with a slide-empty project-level issue when no slides exist", () => {
    const r = computeReadiness({ slides: [], scripts: [], recordings: [] });
    expect(r.canExport).toBe(false);
    expect(r.status).toBe("error");
    expect(r.project.some((p) => p.topic === "slide-empty")).toBe(true);
  });

  it("flags missing script + audio for each slide as errors", () => {
    const r = computeReadiness({
      slides: [slide(0), slide(1)],
      scripts: [],
      recordings: [],
    });
    expect(r.canExport).toBe(false);
    expect(r.slides[0].status).toBe("error");
    expect(r.slides[0].issues.map((i) => i.topic)).toContain("script-missing");
    expect(r.slides[0].issues.map((i) => i.topic)).toContain("audio-missing");
  });

  it("returns canExport=true and status=ok when every slide has content+script+audio matching duration", () => {
    const r = computeReadiness({
      slides: [slide(0), slide(1)],
      scripts: [script(0, "a", 14), script(1, "b", 16)],
      recordings: [recording(0, 15), recording(1, 16)],
    });
    expect(r.canExport).toBe(true);
    expect(r.status).toBe("ok");
    expect(r.totals.errors).toBe(0);
    expect(r.totals.warnings).toBe(0);
  });

  it("flags a duration mismatch as a WARNING (not an error) when actual diverges beyond tolerance", () => {
    const r = computeReadiness({
      slides: [slide(0)],
      scripts: [script(0, "a", 20)],
      recordings: [recording(0, 40)],
    });
    expect(r.canExport).toBe(true); // warning, not blocking
    expect(r.status).toBe("warning");
    const topics = r.slides[0].issues.map((i) => i.topic);
    expect(topics).toContain("duration-mismatch");
  });

  it("blocks export when outline items are unapproved", () => {
    const r = computeReadiness({
      slides: [slide(0)],
      scripts: [script(0)],
      recordings: [recording(0)],
      outlineItems: [outline(0, true), outline(1, false)],
    });
    expect(r.canExport).toBe(false);
    expect(r.project.some((p) => p.topic === "outline-unapproved")).toBe(true);
  });

  it("downgrades unsupported claims to a warning, not a blocker", () => {
    const r = computeReadiness({
      slides: [slide(0)],
      scripts: [script(0)],
      recordings: [recording(0)],
      claims: [claim("c1", []), claim("c2", ["s1"])],
    });
    expect(r.canExport).toBe(true);
    expect(r.status).toBe("warning");
    expect(r.project.find((p) => p.topic === "unsupported-claim")?.message).toContain(
      "1 claim"
    );
  });

  it("includes jumpToStep on every issue so the UI can route the user back", () => {
    const r = computeReadiness({
      slides: [slide(0)],
      scripts: [],
      recordings: [],
      outlineItems: [outline(0, false)],
      claims: [claim("c1", [])],
    });
    const all = [...r.project, ...r.slides.flatMap((s) => s.issues)];
    expect(all.every((i) => typeof i.jumpToStep === "number")).toBe(true);
    expect(
      all.find((i) => i.topic === "script-missing")?.jumpToStep
    ).toBe(4);
    expect(
      all.find((i) => i.topic === "audio-missing")?.jumpToStep
    ).toBe(5);
    expect(
      all.find((i) => i.topic === "outline-unapproved")?.jumpToStep
    ).toBe(2);
    expect(
      all.find((i) => i.topic === "unsupported-claim")?.jumpToStep
    ).toBe(1);
  });

  it("counts totals accurately", () => {
    const r = computeReadiness({
      slides: [slide(0), slide(1), slide(2)],
      scripts: [script(0), script(1)],
      recordings: [recording(0)],
    });
    expect(r.totals.slides).toBe(3);
    expect(r.totals.withScript).toBe(2);
    expect(r.totals.withAudio).toBe(1);
    expect(r.totals.errors).toBeGreaterThan(0);
  });
});
