import { NextRequest, NextResponse } from "next/server";
import { db, outlineItems, projects } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/outline - List a project's outline items in index order
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const rows = await db
      .select()
      .from(outlineItems)
      .where(eq(outlineItems.projectId, projectId));
    rows.sort((a, b) => a.index - b.index);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Failed to load outline:", error);
    return NextResponse.json(
      { error: "Failed to load outline" },
      { status: 500 }
    );
  }
}

interface OutlinePayload {
  id?: string;
  index: number;
  title: string;
  summary?: string;
  speakerGoal?: string;
  claimIds?: string[];
  approved?: boolean;
}

// POST /api/projects/[id]/outline - Replace the outline with the provided list
// Body: { items: OutlinePayload[] }
//
// Treated as an atomic replace: delete all existing items for the project, then
// insert the new set. This keeps reorder/add/remove logic on the client trivial
// (post the desired final state).
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const items: OutlinePayload[] = Array.isArray(body?.items) ? body.items : [];

    for (const item of items) {
      if (!item || typeof item.title !== "string" || !item.title.trim()) {
        return NextResponse.json(
          { error: "Every outline item must have a non-empty title" },
          { status: 400 }
        );
      }
      if (typeof item.index !== "number" || item.index < 0) {
        return NextResponse.json(
          { error: "Every outline item must have a non-negative index" },
          { status: 400 }
        );
      }
    }

    await db.delete(outlineItems).where(eq(outlineItems.projectId, projectId));

    const now = new Date();
    const rows: typeof outlineItems.$inferInsert[] = items.map((item) => ({
      id: item.id || uuid(),
      projectId,
      index: item.index,
      title: item.title.trim(),
      summary: item.summary?.trim() || null,
      speakerGoal: item.speakerGoal?.trim() || null,
      claimIds: item.claimIds ?? [],
      approved: !!item.approved,
      createdAt: now,
      updatedAt: now,
    }));

    if (rows.length > 0) {
      await db.insert(outlineItems).values(rows);
    }

    // If all items are approved, advance the project step (#3 = Slides)
    const allApproved = rows.length > 0 && rows.every((r) => r.approved);
    if (allApproved) {
      await db
        .update(projects)
        .set({ currentStep: 3, updatedAt: now })
        .where(eq(projects.id, projectId));
    }

    const saved = await db
      .select()
      .from(outlineItems)
      .where(eq(outlineItems.projectId, projectId));
    saved.sort((a, b) => a.index - b.index);
    return NextResponse.json(saved, { status: 200 });
  } catch (error) {
    console.error("Failed to save outline:", error);
    return NextResponse.json(
      { error: "Failed to save outline" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/outline - Delete all outline items for a project
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    await db.delete(outlineItems).where(eq(outlineItems.projectId, projectId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete outline:", error);
    return NextResponse.json(
      { error: "Failed to delete outline" },
      { status: 500 }
    );
  }
}
