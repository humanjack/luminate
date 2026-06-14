import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { createTables } from "@/lib/db/migrations";

// Build the DB from the app's real DDL so the plan reflects production.
let sqlite: Database.Database;

beforeAll(() => {
  sqlite = new Database(":memory:");
  createTables(sqlite);
});
afterAll(() => sqlite.close());

function planFor(sql: string): string {
  const rows = sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as Array<{ detail: string }>;
  return rows.map((r) => r.detail).join(" | ");
}

describe("hot-path indexes (GET /api/projects)", () => {
  it("the new indexes exist", () => {
    const names = (
      sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='index'`).all() as Array<{
        name: string;
      }>
    ).map((r) => r.name);
    expect(names).toContain("idx_slides_first");
    expect(names).toContain("idx_slides_project_index");
    expect(names).toContain("idx_thumbnails_selected");
  });

  it("the first-slide lookup uses an index, not a full table scan", () => {
    const plan = planFor(`SELECT project_id, markdown, theme FROM slides WHERE "index" = 0`);
    expect(plan).toMatch(/USING (COVERING )?INDEX/i);
    expect(plan).not.toMatch(/\bSCAN slides\b(?!.*USING)/i);
  });

  it("the selected-thumbnail lookup uses an index, not a full table scan", () => {
    const plan = planFor(`SELECT project_id, svg FROM thumbnails WHERE selected = 1`);
    expect(plan).toMatch(/USING (COVERING )?INDEX/i);
    expect(plan).not.toMatch(/\bSCAN thumbnails\b(?!.*USING)/i);
  });

  it("the per-project ordered slide fetch uses the composite index", () => {
    const plan = planFor(`SELECT * FROM slides WHERE project_id = 'p1' ORDER BY "index"`);
    expect(plan).toMatch(/USING (COVERING )?INDEX/i);
  });
});
