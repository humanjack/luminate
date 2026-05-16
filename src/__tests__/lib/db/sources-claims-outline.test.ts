import { describe, it, expect, beforeAll, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import * as schema from "@/lib/db/schema";

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });

  sqlite.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      current_step INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE videos (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      output_path TEXT,
      duration REAL,
      resolution TEXT DEFAULT '1920x1080',
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      youtube_url TEXT,
      youtube_video_id TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE sources (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('url', 'text', 'manual')),
      url TEXT,
      title TEXT,
      author TEXT,
      published_at TEXT,
      fetched_text TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      trust_notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE claims (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      source_ids TEXT NOT NULL DEFAULT '[]',
      pinned INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'proposed',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE outline_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      "index" INTEGER NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      speaker_goal TEXT,
      claim_ids TEXT NOT NULL DEFAULT '[]',
      approved INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE exports (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      video_id TEXT REFERENCES videos(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER NOT NULL DEFAULT 0,
      resolution TEXT NOT NULL DEFAULT '1920x1080',
      output_path TEXT,
      captions_path TEXT,
      transcript_path TEXT,
      sources_path TEXT,
      duration REAL,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
});

afterEach(() => {
  sqlite.exec("DELETE FROM exports; DELETE FROM outline_items; DELETE FROM claims; DELETE FROM sources; DELETE FROM videos; DELETE FROM projects;");
});

function makeProject(id = uuid()) {
  const now = new Date();
  db.insert(schema.projects)
    .values({ id, name: "Test", currentStep: 1, status: "draft", createdAt: now, updatedAt: now })
    .run();
  return id;
}

describe("sources / claims / outline / exports schema", () => {
  it("persists a URL source with fetched text and status transitions", async () => {
    const projectId = makeProject();
    const sourceId = uuid();
    await db.insert(schema.sources).values({
      id: sourceId,
      projectId,
      type: "url",
      url: "https://example.com/article",
      title: "Example",
      status: "pending",
    });

    await db
      .update(schema.sources)
      .set({ status: "fetched", fetchedText: "hello world" })
      .where(eq(schema.sources.id, sourceId));

    const [row] = await db.select().from(schema.sources).where(eq(schema.sources.id, sourceId));
    expect(row.status).toBe("fetched");
    expect(row.fetchedText).toBe("hello world");
    expect(row.url).toBe("https://example.com/article");
  });

  it("links a claim to multiple sources as JSON ids", async () => {
    const projectId = makeProject();
    const s1 = uuid();
    const s2 = uuid();
    await db.insert(schema.sources).values([
      { id: s1, projectId, type: "url", url: "https://a", status: "approved" },
      { id: s2, projectId, type: "text", title: "Pasted notes", status: "approved" },
    ]);
    const claimId = uuid();
    await db.insert(schema.claims).values({
      id: claimId,
      projectId,
      text: "Birds can fly",
      sourceIds: [s1, s2],
      status: "approved",
    });
    const [row] = await db.select().from(schema.claims).where(eq(schema.claims.id, claimId));
    expect(row.sourceIds).toEqual([s1, s2]);
    expect(row.status).toBe("approved");
  });

  it("supports outline approval and ordering", async () => {
    const projectId = makeProject();
    const c1 = uuid();
    await db.insert(schema.claims).values({ id: c1, projectId, text: "c1", sourceIds: [] });
    await db.insert(schema.outlineItems).values([
      { id: uuid(), projectId, index: 0, title: "Intro", claimIds: [c1], approved: true },
      { id: uuid(), projectId, index: 1, title: "Body", claimIds: [], approved: false },
    ]);
    const rows = await db
      .select()
      .from(schema.outlineItems)
      .where(eq(schema.outlineItems.projectId, projectId));
    rows.sort((a, b) => a.index - b.index);
    expect(rows.map((r) => r.title)).toEqual(["Intro", "Body"]);
    expect(rows[0].approved).toBe(true);
    expect(rows[1].approved).toBe(false);
  });

  it("tracks export progress through lifecycle states", async () => {
    const projectId = makeProject();
    const exportId = uuid();
    await db.insert(schema.exports).values({
      id: exportId,
      projectId,
      status: "pending",
      progress: 0,
    });
    await db
      .update(schema.exports)
      .set({ status: "rendering", progress: 30 })
      .where(eq(schema.exports.id, exportId));
    await db
      .update(schema.exports)
      .set({ status: "encoding", progress: 80 })
      .where(eq(schema.exports.id, exportId));
    await db
      .update(schema.exports)
      .set({
        status: "completed",
        progress: 100,
        outputPath: "/exports/p/out.mp4",
        captionsPath: "/exports/p/captions.vtt",
        transcriptPath: "/exports/p/transcript.txt",
        sourcesPath: "/exports/p/sources.md",
        duration: 123.4,
      })
      .where(eq(schema.exports.id, exportId));
    const [row] = await db.select().from(schema.exports).where(eq(schema.exports.id, exportId));
    expect(row.status).toBe("completed");
    expect(row.progress).toBe(100);
    expect(row.outputPath).toContain("out.mp4");
    expect(row.captionsPath).toContain(".vtt");
    expect(row.duration).toBe(123.4);
  });

  it("cascades delete from project to sources, claims, outline_items, exports", async () => {
    const projectId = makeProject();
    await db.insert(schema.sources).values({ id: uuid(), projectId, type: "url", url: "https://x" });
    await db.insert(schema.claims).values({ id: uuid(), projectId, text: "c", sourceIds: [] });
    await db.insert(schema.outlineItems).values({ id: uuid(), projectId, index: 0, title: "t", claimIds: [] });
    await db.insert(schema.exports).values({ id: uuid(), projectId });

    await db.delete(schema.projects).where(eq(schema.projects.id, projectId));

    expect((await db.select().from(schema.sources)).length).toBe(0);
    expect((await db.select().from(schema.claims)).length).toBe(0);
    expect((await db.select().from(schema.outlineItems)).length).toBe(0);
    expect((await db.select().from(schema.exports)).length).toBe(0);
  });
});
