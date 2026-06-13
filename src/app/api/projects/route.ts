import { NextRequest, NextResponse } from "next/server";
import { db, projects, slides, thumbnails } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// GET /api/projects - List all projects (enriched with a lightweight preview:
// the first slide's markdown and the selected thumbnail's SVG, for card art).
export async function GET() {
  try {
    const allProjects = await db
      .select()
      .from(projects)
      .orderBy(desc(projects.updatedAt));

    const firstSlides = await db
      .select({
        projectId: slides.projectId,
        markdown: slides.markdown,
        theme: slides.theme,
      })
      .from(slides)
      .where(eq(slides.index, 0));

    const selectedThumbs = await db
      .select({ projectId: thumbnails.projectId, svg: thumbnails.svg })
      .from(thumbnails)
      .where(eq(thumbnails.selected, true));

    const slideMap = new Map(firstSlides.map((s) => [s.projectId, s]));
    const thumbMap = new Map(selectedThumbs.map((t) => [t.projectId, t.svg]));

    const enriched = allProjects.map((p) => ({
      ...p,
      previewSlideMarkdown: slideMap.get(p.id)?.markdown ?? null,
      previewSlideTheme: slideMap.get(p.id)?.theme ?? null,
      thumbnailSvg: thumbMap.get(p.id) ?? null,
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    const id = uuid();
    const now = new Date();

    const [newProject] = await db
      .insert(projects)
      .values({
        id,
        name,
        currentStep: 1,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
