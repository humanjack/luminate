import { NextRequest, NextResponse } from "next/server";
import { db, claims, sources } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/claims - List claims for a project
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params;
  const rows = await db
    .select()
    .from(claims)
    .where(eq(claims.projectId, projectId));
  return NextResponse.json(rows);
}

// POST /api/projects/[id]/claims - Replace the claim set
// Body: { items: [{ text, sourceIds?, status? }] }
//
// Atomic replace by project, same shape as the outline endpoint.
// Extracts claims from generated research markdown when called from the
// research auto-save flow.
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const items: Array<{
      id?: string;
      text: string;
      sourceIds?: string[];
      pinned?: boolean;
      status?: "proposed" | "approved" | "rejected";
    }> = Array.isArray(body?.items) ? body.items : [];

    // Validate source ids actually exist for this project to keep the JSON
    // refs honest.
    const allowedSourceIds = new Set(
      (await db.select().from(sources).where(eq(sources.projectId, projectId))).map(
        (s) => s.id
      )
    );

    for (const item of items) {
      if (!item.text?.trim()) {
        return NextResponse.json(
          { error: "Every claim must have non-empty text" },
          { status: 400 }
        );
      }
      if (item.sourceIds?.some((id) => !allowedSourceIds.has(id))) {
        return NextResponse.json(
          { error: "Claim references an unknown source id" },
          { status: 400 }
        );
      }
    }

    await db.delete(claims).where(eq(claims.projectId, projectId));

    const now = new Date();
    const rows: typeof claims.$inferInsert[] = items.map((item) => ({
      id: item.id || uuid(),
      projectId,
      text: item.text.trim(),
      sourceIds: item.sourceIds ?? [],
      pinned: !!item.pinned,
      status: item.status ?? "proposed",
      createdAt: now,
      updatedAt: now,
    }));
    if (rows.length > 0) {
      await db.insert(claims).values(rows);
    }

    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error("Failed to save claims:", error);
    return NextResponse.json(
      { error: "Failed to save claims" },
      { status: 500 }
    );
  }
}
