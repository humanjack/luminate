import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import * as schema from "@/lib/db/schema";
import { createTables } from "@/lib/db/migrations";

// In-memory database built from the app's real DDL so the test can never
// drift from what `initializeDatabase()` actually creates.
let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite, { schema });
  createTables(sqlite);
});

afterAll(() => {
  sqlite.close();
});

beforeEach(() => {
  // Clean tables before each test
  sqlite.exec(`
    DELETE FROM analysis_results;
    DELETE FROM recordings;
    DELETE FROM scripts;
    DELETE FROM slides;
    DELETE FROM content_data;
    DELETE FROM research_data;
    DELETE FROM videos;
    DELETE FROM projects;
    DELETE FROM settings;
  `);
});

describe("Database Schema", () => {
  describe("Projects table", () => {
    it("should create a project", async () => {
      const id = uuid();
      const now = new Date();

      await db.insert(schema.projects).values({
        id,
        name: "Test Project",
        currentStep: 1,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });

      const [project] = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, id));

      expect(project).toBeDefined();
      expect(project.name).toBe("Test Project");
      expect(project.currentStep).toBe(1);
      expect(project.status).toBe("draft");
    });

    it("should update a project", async () => {
      const id = uuid();
      const now = new Date();

      await db.insert(schema.projects).values({
        id,
        name: "Original Name",
        currentStep: 1,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });

      await db
        .update(schema.projects)
        .set({ name: "Updated Name", currentStep: 3 })
        .where(eq(schema.projects.id, id));

      const [project] = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, id));

      expect(project.name).toBe("Updated Name");
      expect(project.currentStep).toBe(3);
    });

    it("should delete a project", async () => {
      const id = uuid();
      const now = new Date();

      await db.insert(schema.projects).values({
        id,
        name: "To Delete",
        currentStep: 1,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(schema.projects).where(eq(schema.projects.id, id));

      const projects = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, id));

      expect(projects).toHaveLength(0);
    });
  });

  describe("Research data table", () => {
    it("should create research data linked to project", async () => {
      const projectId = uuid();
      const researchId = uuid();
      const now = new Date();

      await db.insert(schema.projects).values({
        id: projectId,
        name: "Project",
        currentStep: 1,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(schema.researchData).values({
        id: researchId,
        projectId,
        topic: "React Hooks",
        depth: "detailed",
        content: "# Research Content\n\nThis is research...",
        sources: [{ title: "React Docs", url: "https://react.dev" }],
        createdAt: now,
        updatedAt: now,
      });

      const [research] = await db
        .select()
        .from(schema.researchData)
        .where(eq(schema.researchData.projectId, projectId));

      expect(research).toBeDefined();
      expect(research.topic).toBe("React Hooks");
      expect(research.depth).toBe("detailed");
    });

    it("should cascade delete research when project is deleted", async () => {
      const projectId = uuid();
      const researchId = uuid();
      const now = new Date();

      await db.insert(schema.projects).values({
        id: projectId,
        name: "Project",
        currentStep: 1,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(schema.researchData).values({
        id: researchId,
        projectId,
        topic: "Topic",
        depth: "quick",
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(schema.projects).where(eq(schema.projects.id, projectId));

      const research = await db
        .select()
        .from(schema.researchData)
        .where(eq(schema.researchData.id, researchId));

      expect(research).toHaveLength(0);
    });
  });

  describe("Slides table", () => {
    it("should create multiple slides for a project", async () => {
      const projectId = uuid();
      const now = new Date();

      await db.insert(schema.projects).values({
        id: projectId,
        name: "Project",
        currentStep: 3,
        status: "in_progress",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(schema.slides).values([
        {
          id: uuid(),
          projectId,
          index: 0,
          markdown: "# Slide 1",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: uuid(),
          projectId,
          index: 1,
          markdown: "# Slide 2",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: uuid(),
          projectId,
          index: 2,
          markdown: "# Slide 3",
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const slides = await db
        .select()
        .from(schema.slides)
        .where(eq(schema.slides.projectId, projectId));

      expect(slides).toHaveLength(3);
    });
  });

  describe("Scripts table", () => {
    it("should create scripts linked to slides", async () => {
      const projectId = uuid();
      const slideId = uuid();
      const scriptId = uuid();
      const now = new Date();

      await db.insert(schema.projects).values({
        id: projectId,
        name: "Project",
        currentStep: 4,
        status: "in_progress",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(schema.slides).values({
        id: slideId,
        projectId,
        index: 0,
        markdown: "# Slide",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(schema.scripts).values({
        id: scriptId,
        projectId,
        slideId,
        slideIndex: 0,
        text: "Welcome to this video...",
        estimatedDuration: 45,
        createdAt: now,
        updatedAt: now,
      });

      const [script] = await db
        .select()
        .from(schema.scripts)
        .where(eq(schema.scripts.id, scriptId));

      expect(script).toBeDefined();
      expect(script.text).toBe("Welcome to this video...");
      expect(script.estimatedDuration).toBe(45);
    });
  });

  describe("Recordings and Analysis", () => {
    it("should create recording with analysis results", async () => {
      const projectId = uuid();
      const recordingId = uuid();
      const analysisId = uuid();
      const now = new Date();

      await db.insert(schema.projects).values({
        id: projectId,
        name: "Project",
        currentStep: 6,
        status: "in_progress",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(schema.recordings).values({
        id: recordingId,
        projectId,
        slideIndex: 0,
        audioPath: "/audio/recording.webm",
        duration: 45.5,
        createdAt: now,
      });

      await db.insert(schema.analysisResults).values({
        id: analysisId,
        recordingId,
        projectId,
        overallScore: 85.5,
        pronunciationScore: 88.0,
        fluencyScore: 82.0,
        confidenceScore: 90.0,
        wordsPerMinute: 145,
        recommendations: ["Slow down slightly", "Reduce filler words"],
        createdAt: now,
      });

      const [analysis] = await db
        .select()
        .from(schema.analysisResults)
        .where(eq(schema.analysisResults.recordingId, recordingId));

      expect(analysis).toBeDefined();
      expect(analysis.overallScore).toBe(85.5);
      expect(analysis.wordsPerMinute).toBe(145);
    });

    it("should cascade delete analysis when recording is deleted", async () => {
      const projectId = uuid();
      const recordingId = uuid();
      const analysisId = uuid();
      const now = new Date();

      await db.insert(schema.projects).values({
        id: projectId,
        name: "Project",
        currentStep: 6,
        status: "in_progress",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(schema.recordings).values({
        id: recordingId,
        projectId,
        audioPath: "/audio/test.webm",
        createdAt: now,
      });

      await db.insert(schema.analysisResults).values({
        id: analysisId,
        recordingId,
        projectId,
        overallScore: 80,
        createdAt: now,
      });

      await db
        .delete(schema.recordings)
        .where(eq(schema.recordings.id, recordingId));

      const results = await db
        .select()
        .from(schema.analysisResults)
        .where(eq(schema.analysisResults.id, analysisId));

      expect(results).toHaveLength(0);
    });
  });

  describe("Videos table", () => {
    it("should create video with processing status", async () => {
      const projectId = uuid();
      const videoId = uuid();
      const now = new Date();

      await db.insert(schema.projects).values({
        id: projectId,
        name: "Project",
        currentStep: 7,
        status: "in_progress",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(schema.videos).values({
        id: videoId,
        projectId,
        status: "pending",
        progress: 0,
        resolution: "1920x1080",
        createdAt: now,
        updatedAt: now,
      });

      const [video] = await db
        .select()
        .from(schema.videos)
        .where(eq(schema.videos.id, videoId));

      expect(video).toBeDefined();
      expect(video.status).toBe("pending");
      expect(video.progress).toBe(0);
    });

    it("should update video progress", async () => {
      const projectId = uuid();
      const videoId = uuid();
      const now = new Date();

      await db.insert(schema.projects).values({
        id: projectId,
        name: "Project",
        currentStep: 7,
        status: "in_progress",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(schema.videos).values({
        id: videoId,
        projectId,
        status: "pending",
        progress: 0,
        createdAt: now,
        updatedAt: now,
      });

      await db
        .update(schema.videos)
        .set({ status: "processing", progress: 50 })
        .where(eq(schema.videos.id, videoId));

      const [video] = await db
        .select()
        .from(schema.videos)
        .where(eq(schema.videos.id, videoId));

      expect(video.status).toBe("processing");
      expect(video.progress).toBe(50);
    });
  });

  describe("Settings table", () => {
    it("should store and retrieve settings", async () => {
      const now = new Date();

      await db.insert(schema.settings).values([
        { key: "llmProvider", value: "anthropic", updatedAt: now },
        { key: "theme", value: "dark", updatedAt: now },
      ]);

      const settings = await db.select().from(schema.settings);

      expect(settings).toHaveLength(2);
      expect(settings.find((s) => s.key === "llmProvider")?.value).toBe(
        "anthropic"
      );
      expect(settings.find((s) => s.key === "theme")?.value).toBe("dark");
    });

    it("should update settings", async () => {
      const now = new Date();

      await db.insert(schema.settings).values({
        key: "theme",
        value: "light",
        updatedAt: now,
      });

      await db
        .update(schema.settings)
        .set({ value: "dark" })
        .where(eq(schema.settings.key, "theme"));

      const [setting] = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, "theme"));

      expect(setting.value).toBe("dark");
    });
  });
});
