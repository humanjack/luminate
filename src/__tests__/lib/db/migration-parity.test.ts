import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import * as schema from "@/lib/db/schema";
import { createTables } from "@/lib/db/migrations";

const folder = path.resolve("drizzle");
const connections: Database.Database[] = [];
const tempDirectories: string[] = [];
function database(filename = ":memory:") {
  const sqlite = new Database(filename);
  connections.push(sqlite);
  return sqlite;
}
afterEach(() => {
  connections.splice(0).forEach((sqlite) => sqlite.close());
  tempDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});
function tables(sqlite: Database.Database) {
  return (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name").all() as {name: string}[]).map(({name}) => name);
}
function columns(sqlite: Database.Database, table: string) {
  return (sqlite.pragma(`table_info("${table}")`) as {name: string; type: string; notnull: number; pk: number; dflt_value: string | null}[])
    .map(({name, type, notnull, pk, dflt_value}) => ({name, type: type.toLowerCase(), notnull, pk, dflt_value: dflt_value === "false" ? "0" : dflt_value}))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function applyMigrations(sqlite: Database.Database) {
  // Table rebuilds must not cascade-delete existing child rows.
  sqlite.pragma("foreign_keys = OFF");
  migrate(drizzle(sqlite), { migrationsFolder: folder });
  sqlite.pragma("foreign_keys = ON");
  expect(sqlite.pragma("foreign_key_check")).toEqual([]);
}
function expectParity(runtime: Database.Database, migrated: Database.Database) {
  expect(tables(migrated)).toEqual(tables(runtime));
  for (const table of tables(runtime)) {
    expect(columns(migrated, table), table).toEqual(columns(runtime, table));
    const foreignKeys = (db: Database.Database) => (db.pragma(`foreign_key_list("${table}")`) as {id: number; seq: number; table: string; from: string; to: string; on_update: string; on_delete: string; match: string}[])
      .map(({seq, table, from, to, on_update, on_delete, match}) => ({seq, table, from, to, on_update, on_delete, match})).sort((a,b) => a.from.localeCompare(b.from));
    expect(foreignKeys(migrated), table).toEqual(foreignKeys(runtime));
    const checks = (db: Database.Database) => {
      const { sql } = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as { sql: string };
      return [...sql.matchAll(/CHECK\(([\s\S]*?\))\)/gi)]
        .map((match) => match[1].replace(/"\w+"\./g, "").replace(/["\s]/g, "").toLowerCase()).sort();
    };
    expect(checks(migrated), table).toEqual(checks(runtime));
  }
  const indexes = (db: Database.Database) => (db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name").all() as {name: string; sql: string}[])
    .map(({name, sql}) => ({name, sql: sql.toLowerCase().replace(/if not exists|[`"\s]/g, "").replace(/(?:slides|thumbnails)\./g, "")}));
  expect(indexes(migrated)).toEqual(indexes(runtime));
}

describe("migration parity", () => {
  it("includes every committed SQL migration in the journal", () => {
    const journal = JSON.parse(readFileSync(path.join(folder, "meta/_journal.json"), "utf8")) as { entries: { tag: string; idx: number; when: number }[] };
    expect(journal.entries.map(({tag}) => `${tag}.sql`).sort())
      .toEqual(readdirSync(folder).filter((file) => file.endsWith(".sql")).sort());
    expect(journal.entries.map(({idx}) => idx)).toEqual(journal.entries.map((_, idx) => idx));
    expect(journal.entries.every((entry, idx) => idx === 0 || entry.when > journal.entries[idx - 1].when)).toBe(true);
  });

  it("provisions the same tables, columns, indexes and foreign keys through the journal", () => {
    const runtime = database();
    createTables(runtime);
    const migrated = database();
    applyMigrations(migrated);
    expectParity(runtime, migrated);
    applyMigrations(migrated); // Re-running the documented migration path is safe.
    expectParity(runtime, migrated);
  });

  it("keeps the ORM table and column definitions aligned with runtime provisioning", () => {
    const runtime = database();
    createTables(runtime);
    const definitions = Object.values(schema).filter((value) => is(value, Table));
    expect(definitions.map(getTableName).sort()).toEqual(tables(runtime));
    for (const table of definitions) {
      expect(Object.values(getTableColumns(table)).map(({name}) => name).sort(), getTableName(table))
        .toEqual(columns(runtime, getTableName(table)).map(({name}) => name).sort());
    }
  });

  it("upgrades the original journal without losing projects or dependent media", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "luminate-migration-"));
    tempDirectories.push(directory);
    const sqlite = database(path.join(directory, "luminate.db"));
    const journal = JSON.parse(readFileSync(path.join(folder, "meta/_journal.json"), "utf8"));
    sqlite.exec(readFileSync(path.join(folder, "0000_volatile_cloak.sql"), "utf8"));
    sqlite.exec("CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash text NOT NULL, created_at numeric)");
    sqlite.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)").run("legacy", journal.entries[0].when);
    sqlite.exec(`
      INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p', 'Preserved', 1, 2);
      INSERT INTO slides (id, project_id, "index", markdown, created_at, updated_at) VALUES ('s', 'p', 0, '# Slide', 1, 2);
      INSERT INTO scripts (id, project_id, slide_id, slide_index, text, created_at, updated_at) VALUES ('t', 'p', 's', 0, 'Narration', 1, 2);
      INSERT INTO recordings (id, project_id, slide_id, audio_path, audio_data, created_at) VALUES ('r', 'p', 's', '/recordings/r.webm', X'010203', 1);
      INSERT INTO analysis_results (id, recording_id, project_id, overall_score, created_at) VALUES ('a', 'r', 'p', 95, 1);
      INSERT INTO research_data (id, project_id, topic, created_at, updated_at) VALUES ('research', 'p', 'Topic', 1, 2);
      INSERT INTO content_data (id, project_id, markdown, created_at, updated_at) VALUES ('content', 'p', '# Content', 1, 2);
      INSERT INTO videos (id, project_id, output_path, created_at, updated_at) VALUES ('v', 'p', '/exports/v.mp4', 1, 2);
      INSERT INTO settings (key, value, updated_at) VALUES ('theme', 'dark', 2);
    `);
    const before = Object.fromEntries(tables(sqlite).map((table) => [table, sqlite.prepare(`SELECT * FROM "${table}"`).all()]));
    sqlite.pragma("foreign_keys = ON");
    execFileSync(process.execPath, ["scripts/migrate-db.mjs"], {
      env: { ...process.env, LUMINATE_DATA_DIR: directory },
    });
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    for (const [table, rows] of Object.entries(before)) {
      expect(sqlite.prepare(`SELECT * FROM "${table}"`).all()).toMatchObject(rows);
    }
    const runtime = database();
    createTables(runtime);
    expectParity(runtime, sqlite);
    expect(() => sqlite.exec("UPDATE projects SET status = 'invalid' WHERE id = 'p'")).toThrow(/CHECK/);
    expect(() => sqlite.exec("UPDATE research_data SET depth = 'invalid'")).toThrow(/CHECK/);
    expect(() => sqlite.exec("UPDATE content_data SET format = 'invalid'")).toThrow(/CHECK/);
    expect(() => sqlite.exec("UPDATE videos SET status = 'invalid'")).toThrow(/CHECK/);
    sqlite.exec("DELETE FROM projects WHERE id = 'p'");
    expect(sqlite.prepare("SELECT * FROM recordings").all()).toEqual([]);
  });
  it("rolls back the entire upgrade if legacy data violates a new constraint", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "luminate-migration-"));
    tempDirectories.push(directory);
    const sqlite = database(path.join(directory, "luminate.db"));
    const journal = JSON.parse(readFileSync(path.join(folder, "meta/_journal.json"), "utf8"));
    sqlite.exec(readFileSync(path.join(folder, "0000_volatile_cloak.sql"), "utf8"));
    sqlite.exec("CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash text NOT NULL, created_at numeric)");
    sqlite.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)").run("legacy", journal.entries[0].when);
    sqlite.exec("INSERT INTO projects (id, name, status, created_at, updated_at) VALUES ('p', 'Untouched', 'invalid', 1, 2)");
    const beforeTables = tables(sqlite);
    expect(() => execFileSync(process.execPath, ["scripts/migrate-db.mjs"], {
      env: { ...process.env, LUMINATE_DATA_DIR: directory }, stdio: "pipe",
    })).toThrow();
    expect(tables(sqlite)).toEqual(beforeTables);
    expect(sqlite.prepare("SELECT name, status FROM projects WHERE id = 'p'").get())
      .toEqual({ name: "Untouched", status: "invalid" });
    expect(sqlite.prepare("SELECT * FROM __drizzle_migrations").all()).toHaveLength(1);
    expect(columns(sqlite, "analysis_results").map(({name}) => name)).not.toContain("transcript");
  });

  it("rolls back schema and journal entries when a migration introduces broken references", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "luminate-invalid-migration-"));
    tempDirectories.push(directory);
    const migrationFolder = path.join(directory, "migrations");
    mkdirSync(path.join(migrationFolder, "meta"), { recursive: true });
    writeFileSync(path.join(migrationFolder, "meta/_journal.json"), JSON.stringify({
      entries: [{ idx: 0, when: 1, tag: "0000_broken", breakpoints: true }],
    }));
    writeFileSync(path.join(migrationFolder, "0000_broken.sql"), `
      CREATE TABLE child (parent_id TEXT REFERENCES parent(id));
      INSERT INTO child (parent_id) VALUES ('missing');
      UPDATE parent SET name = 'Changed';
    `);
    const dbPath = path.join(directory, "luminate.db");
    const sqlite = database(dbPath);
    sqlite.exec("CREATE TABLE parent (id TEXT PRIMARY KEY, name TEXT); INSERT INTO parent VALUES ('p', 'Original')");
    expect(() => execFileSync(process.execPath, ["--input-type=module", "-e", `
      import Database from 'better-sqlite3';
      import { migrateDatabase } from './scripts/migrate-db.mjs';
      const db = new Database(process.argv[1]);
      try { migrateDatabase(db, process.argv[2]); } finally { db.close(); }
    `, dbPath, migrationFolder], { stdio: "pipe" })).toThrow();
    expect(tables(sqlite)).toEqual(["parent"]);
    expect(sqlite.prepare("SELECT name FROM parent").get()).toEqual({ name: "Original" });
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name = '__drizzle_migrations'").all()).toEqual([]);
  });

});
