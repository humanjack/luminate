import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { createTables, verifySchema, EXPECTED_TABLES } from "@/lib/db/migrations";

function freshDb(): Database.Database {
  const sqlite = new Database(":memory:");
  createTables(sqlite);
  return sqlite;
}

describe("schema verification + idempotency", () => {
  it("EXPECTED_TABLES lists the full 18-table schema", () => {
    expect(EXPECTED_TABLES.length).toBe(18);
    expect(new Set(EXPECTED_TABLES).size).toBe(18); // no dupes
  });

  it("verifySchema reports all tables present on a freshly provisioned DB", () => {
    const db = freshDb();
    const check = verifySchema(db);
    expect(check.ok).toBe(true);
    expect(check.present.length).toBe(18);
    expect(check.missing).toEqual([]);
    db.close();
  });

  it("verifySchema names a missing table", () => {
    const db = freshDb();
    db.exec("DROP TABLE thumbnails;");
    const check = verifySchema(db);
    expect(check.ok).toBe(false);
    expect(check.missing).toContain("thumbnails");
    db.close();
  });

  it("createTables is idempotent (re-running is a no-op, no throw)", () => {
    const db = new Database(":memory:");
    createTables(db);
    const countBefore = (
      db.prepare("SELECT count(*) c FROM sqlite_master WHERE type='table'").get() as { c: number }
    ).c;
    expect(() => createTables(db)).not.toThrow();
    const countAfter = (
      db.prepare("SELECT count(*) c FROM sqlite_master WHERE type='table'").get() as { c: number }
    ).c;
    expect(countAfter).toBe(countBefore);
    db.close();
  });

  it("sets busy_timeout on the provisioning connection", () => {
    const db = new Database(":memory:");
    createTables(db);
    const timeout = db.pragma("busy_timeout", { simple: true });
    expect(timeout).toBe(5000);
    db.close();
  });
});
