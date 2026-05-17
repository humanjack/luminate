import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, videoMetadata } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const runtime = "nodejs";

// GET /api/projects/[id]/video-metadata — return the latest generated metadata, if any.
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const [row] = await db
    .select()
    .from(videoMetadata)
    .where(eq(videoMetadata.projectId, id));
  return NextResponse.json(row ?? null);
}

// PATCH /api/projects/[id]/video-metadata — persist user edits (selected title, manual description tweaks).
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json();
  const [existing] = await db
    .select()
    .from(videoMetadata)
    .where(eq(videoMetadata.projectId, id));
  if (!existing) {
    return NextResponse.json({ error: "No metadata yet — generate first." }, { status: 404 });
  }
  const [updated] = await db
    .update(videoMetadata)
    .set({
      selectedTitleIndex:
        typeof body.selectedTitleIndex === "number"
          ? body.selectedTitleIndex
          : existing.selectedTitleIndex,
      description:
        typeof body.description === "string" ? body.description : existing.description,
      tags: Array.isArray(body.tags) ? body.tags : existing.tags,
      updatedAt: new Date(),
    })
    .where(eq(videoMetadata.id, existing.id))
    .returning();
  return NextResponse.json(updated);
}
