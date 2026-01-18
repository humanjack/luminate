import { NextRequest, NextResponse } from "next/server";
import { db, projects } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// GET /api/projects - List all projects
export async function GET() {
  try {
    const allProjects = await db
      .select()
      .from(projects)
      .orderBy(desc(projects.updatedAt));

    return NextResponse.json(allProjects);
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
    const { name } = body;

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
