import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

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

  // Replace previous variants
  await db.delete(thumbnails).where(eq(thumbnails.projectId, id));
  const now = new Date();
  const inserted = await Promise.all(
    generated.map((g) =>
      db
        .insert(thumbnails)
        .values({
          id: uuid(),
          projectId: id,
          preset: g.preset,
          svg: g.svg,
          selected: false,
          createdAt: now,
        })
        .returning()
    )
  );

  return NextResponse.json(inserted.map(([row]) => row));
}

// PATCH /api/projects/:id/thumbnails — set the currently selected variant.
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = (await request.json()) as { preset?: ThumbnailPreset };
  if (!body.preset) {
    return NextResponse.json({ error: "preset required" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(thumbnails)
    .where(eq(thumbnails.projectId, id));

  await Promise.all(
    rows.map((row) =>
      db
        .update(thumbnails)
        .set({ selected: row.preset === body.preset })
        .where(eq(thumbnails.id, row.id))
    )
  );

  const updated = await db
    .select()
    .from(thumbnails)
    .where(eq(thumbnails.projectId, id));
  return NextResponse.json(updated);
}
