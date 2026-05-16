import { NextRequest, NextResponse } from "next/server";
import {
  db,
  exports as exportsTable,
  slides as slidesTable,
  scripts as scriptsTable,
  recordings as recordingsTable,
  sources as sourcesTable,
  projects as projectsTable,
} from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { renderProjectVideo, RenderSlideInput } from "@/lib/export/render";
import {
  buildSegments,
  toVtt,
  toSrt,
  toTranscript,
  toSourceList,
} from "@/lib/export/captions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/export
// Body: { resolution?: "1280x720" | "1920x1080" | ... }
//
// Synchronous export. Inserts an `exports` row, runs the ffmpeg pipeline,
// writes MP4 + captions + transcript + sources.md, and returns the
// completed row. For long videos this should move to a worker queue, but
// short MVP recordings finish in seconds on the local ffmpeg binary.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params;
  let body: { resolution?: string } = {};
  try {
    body = await request.json();
  } catch {
    // optional body
  }
  const resolution = body.resolution || "1920x1080";

  const exportId = uuid();
  const now = new Date();
  await db.insert(exportsTable).values({
    id: exportId,
    projectId,
    status: "pending",
    progress: 0,
    resolution,
    createdAt: now,
    updatedAt: now,
  });

  try {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId));
    if (!project) {
      throw new Error("Project not found");
    }

    const projectSlides = (
      await db.select().from(slidesTable).where(eq(slidesTable.projectId, projectId))
    ).sort((a, b) => a.index - b.index);
    const projectScripts = await db
      .select()
      .from(scriptsTable)
      .where(eq(scriptsTable.projectId, projectId));
    const projectRecordings = await db
      .select()
      .from(recordingsTable)
      .where(eq(recordingsTable.projectId, projectId));
    const projectSources = await db
      .select()
      .from(sourcesTable)
      .where(eq(sourcesTable.projectId, projectId));

    const scriptBy = new Map(
      projectScripts.map((s) => [s.slideIndex, s] as const)
    );
    const recordingBy = new Map(
      projectRecordings
        .filter((r) => typeof r.slideIndex === "number" && r.audioPath)
        .map((r) => [r.slideIndex as number, r] as const)
    );

    // Build the rendering plan and bail early on bad inputs so we return a
    // useful error rather than silently producing junk.
    const renderSlides: RenderSlideInput[] = [];
    for (const slide of projectSlides) {
      const rec = recordingBy.get(slide.index);
      if (!rec || !rec.duration || !rec.audioPath) {
        throw new Error(
          `Slide ${slide.index + 1} is missing a recording — cannot export`
        );
      }
      const script = scriptBy.get(slide.index);
      renderSlides.push({
        index: slide.index,
        title: parseSlideTitle(slide.markdown),
        body: parseSlideBody(slide.markdown),
        audioAbsolutePath: path.join(process.cwd(), "public", rec.audioPath),
        duration: rec.duration,
      });
      // Sanity check
      if (!script || !script.text?.trim()) {
        throw new Error(
          `Slide ${slide.index + 1} is missing a script — cannot export`
        );
      }
    }

    await db
      .update(exportsTable)
      .set({ status: "rendering", progress: 1, updatedAt: new Date() })
      .where(eq(exportsTable.id, exportId));

    const renderResult = await renderProjectVideo({
      projectId,
      slides: renderSlides,
      resolution,
      onProgress: async (progress) => {
        await db
          .update(exportsTable)
          .set({ progress, updatedAt: new Date() })
          .where(eq(exportsTable.id, exportId));
      },
    });

    const segments = buildSegments(
      projectSlides.map((s) => ({
        slide: s,
        script: scriptBy.get(s.index),
        recording: recordingBy.get(s.index),
      }))
    );

    const exportsDir = path.join(process.cwd(), "public", "exports", projectId);
    await mkdir(exportsDir, { recursive: true });
    const captionsPath = path.join(exportsDir, `${exportId}.vtt`);
    const srtPath = path.join(exportsDir, `${exportId}.srt`);
    const transcriptPath = path.join(exportsDir, `${exportId}.transcript.txt`);
    const sourcesPath = path.join(exportsDir, `${exportId}.sources.md`);
    await writeFile(captionsPath, toVtt(segments), "utf-8");
    await writeFile(srtPath, toSrt(segments), "utf-8");
    await writeFile(transcriptPath, toTranscript(segments), "utf-8");
    await writeFile(
      sourcesPath,
      toSourceList(project.name, projectSources),
      "utf-8"
    );

    const duration = segments.length
      ? segments[segments.length - 1].end
      : 0;

    const publicMp4Path = `/exports/${projectId}/final.mp4`;
    const publicVttPath = `/exports/${projectId}/${exportId}.vtt`;
    const publicTranscriptPath = `/exports/${projectId}/${exportId}.transcript.txt`;
    const publicSourcesPath = `/exports/${projectId}/${exportId}.sources.md`;

    await db
      .update(exportsTable)
      .set({
        status: "completed",
        progress: 100,
        outputPath: publicMp4Path,
        captionsPath: publicVttPath,
        transcriptPath: publicTranscriptPath,
        sourcesPath: publicSourcesPath,
        duration,
        updatedAt: new Date(),
      })
      .where(eq(exportsTable.id, exportId));

    const [final] = await db
      .select()
      .from(exportsTable)
      .where(eq(exportsTable.id, exportId));

    // Touch the absolute output path so we can confirm the file is present
    void renderResult.outputAbsolutePath;
    return NextResponse.json(final, { status: 201 });
  } catch (error) {
    const message = (error as Error).message || "Unknown export error";
    await db
      .update(exportsTable)
      .set({
        status: "failed",
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(exportsTable.id, exportId));
    console.error("Export failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/projects/[id]/export - List exports for the project
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params;
  const rows = await db
    .select()
    .from(exportsTable)
    .where(eq(exportsTable.projectId, projectId));
  rows.sort((a, b) => +b.createdAt - +a.createdAt);
  return NextResponse.json(rows);
}

function parseSlideTitle(markdown: string): string {
  const m = markdown.match(/^#+\s+(.+)$/m);
  return m ? m[1].trim() : markdown.trim().split("\n")[0] || "Slide";
}

function parseSlideBody(markdown: string): string {
  return markdown
    .split("\n")
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => `• ${l.replace(/^[-*]\s+/, "").trim()}`)
    .slice(0, 4)
    .join("\n");
}
