import Database from "better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function migrateDatabase(sqlite, migrationsFolder) {
  const migrations = readMigrationFiles({ migrationsFolder });
  sqlite.pragma("busy_timeout = 5000");
  const foreignKeys = sqlite.pragma("foreign_keys", { simple: true });
  // SQLite ignores foreign_keys changes inside a transaction. Rebuilds must
  // disable it first, or replacing a parent table can delete its child rows.
  sqlite.pragma("foreign_keys = OFF");
  try {
    sqlite.transaction(() => {
      if (sqlite.pragma("foreign_key_check").length > 0) {
        throw new Error("Existing database has foreign-key violations; repair them before migrating.");
      }
      // Keep Drizzle's journal format and timestamp ordering so databases
      // created by its original migrator continue along the same history.
      sqlite.exec("CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash text NOT NULL, created_at numeric)");
      const latest = sqlite.prepare("SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1").get();
      for (const migration of migrations) {
        if (latest && Number(latest.created_at) >= migration.folderMillis) continue;
        for (const statement of migration.sql) sqlite.exec(statement);
        sqlite.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
          .run(migration.hash, migration.folderMillis);
      }
      // Check BEFORE commit: a broken new reference must roll back the DDL,
      // data changes and journal entries together.
      if (sqlite.pragma("foreign_key_check").length > 0) {
        throw new Error("Migration introduced foreign-key violations; changes rolled back.");
      }
    }).immediate();
  } finally {
    sqlite.pragma(`foreign_keys = ${foreignKeys ? "ON" : "OFF"}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const dbPath = process.env.LUMINATE_DATA_DIR
    ? path.join(process.env.LUMINATE_DATA_DIR, "luminate.db")
    : path.resolve("luminate.db");
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  try {
    migrateDatabase(sqlite, fileURLToPath(new URL("../drizzle", import.meta.url)));
    console.log(`Database migrations applied: ${dbPath}`);
  } finally {
    sqlite.close();
  }
}
