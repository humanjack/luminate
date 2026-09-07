import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { readJson } from "@/lib/api/validate";

import {
  db,
  thumbnails,
  researchData,
  contentData,
  slides as slidesTable,
} from "@/lib/db";
import { renderAllPresets } from "@/lib/thumbnails/presets";
import { pickNumberHook } from "@/lib/thumbnails/escape";
import type { ThumbnailPreset } from "@/lib/thumbnails/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const runtime = "nodejs";

// GET /api/projects/:id/thumbnails — list existing variants for this project (latest run).
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const rows = await db
    .select()
    .from(thumbnails)
    .where(eq(thumbnails.projectId, id));
  return NextResponse.json(rows);
}

// POST /api/projects/:id/thumbnails — regenerate the 4 variants from current project data.
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const [research] = await db
    .select()
    .from(researchData)
    .where(eq(researchData.projectId, id));
  const [content] = await db
    .select()
    .from(contentData)
    .where(eq(contentData.projectId, id));
  const projectSlides = await db
    .select()
    .from(slidesTable)
    .where(eq(slidesTable.projectId, id));
  projectSlides.sort((a, b) => a.index - b.index);

  const topic = research?.topic ?? content?.title ?? "Luminate";
  const title = content?.title ?? research?.topic ?? "Untitled video";
  const firstSlideMd = projectSlides[0]?.markdown ?? "";
  const firstSlideHeading = firstSlideMd.match(/^#+\s+(.+)$/m)?.[1] ?? title;
  const numberHook = pickNumberHook(title);

  const generated = renderAllPresets({
    topic,
    title,
    firstSlideTitle: firstSlideHeading,
    numberHook,
  });

  const now = new Date();
  const inserted = db.transaction((tx) => {
    tx.delete(thumbnails).where(eq(thumbnails.projectId, id)).run();
    return generated.map((g) =>
      tx.insert(thumbnails)
        .values({
          id: uuid(), projectId: id, preset: g.preset, svg: g.svg,
          selected: false, createdAt: now,
        })
        .returning().get()
    );
  });

  return NextResponse.json(inserted);
}

// PATCH /api/projects/:id/thumbnails — set the currently selected variant.
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;
  const body = (parsed.data ?? {}) as { preset?: ThumbnailPreset };
  if (!body.preset) {
    return NextResponse.json({ error: "preset required" }, { status: 400 });
  }

  const updated = db.transaction((tx) => {
    const rows = tx.select().from(thumbnails)
      .where(eq(thumbnails.projectId, id)).all();
    const chosen = rows.find((row) => row.preset === body.preset);
    if (!chosen) return null;

    tx.update(thumbnails).set({ selected: false })
      .where(eq(thumbnails.projectId, id)).run();
    tx.update(thumbnails).set({ selected: true })
      .where(eq(thumbnails.id, chosen.id)).run();
    return tx.select().from(thumbnails)
      .where(eq(thumbnails.projectId, id)).all();
  });
  if (!updated) {
    return NextResponse.json({ error: "Thumbnail preset not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
