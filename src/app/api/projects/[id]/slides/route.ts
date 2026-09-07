import { NextRequest, NextResponse } from "next/server";
import { db, slides, projects } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/slides - Save slides
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const { slides: slidesData } = body;

    if (!Array.isArray(slidesData)) {
      return NextResponse.json(
        { error: "Slides must be an array" },
        { status: 400 }
      );
    }

    const now = new Date();

    const newSlides = db.transaction((tx) => {
      tx.delete(slides).where(eq(slides.projectId, projectId)).run();
      const inserted = slidesData.map((slide: typeof slides.$inferInsert, index: number) =>
        tx.insert(slides)
          .values({
            id: slide.id || uuid(),
            projectId,
            index,
            markdown: slide.markdown,
            imageData: slide.imageData,
            theme: slide.theme || "default",
            createdAt: now,
            updatedAt: now,
          })
          .returning()
          .get()
      );
      tx.update(projects)
        .set({ currentStep: 4, updatedAt: now })
        .where(eq(projects.id, projectId))
        .run();
      return inserted;
    });

    return NextResponse.json(newSlides);
  } catch (error) {
    console.error("Failed to save slides:", error);
    return NextResponse.json(
      { error: "Failed to save slides" },
      { status: 500 }
    );
  }
}
