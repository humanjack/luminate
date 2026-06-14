import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { dbFilePath } from "@/lib/paths";

const sqlite = new Database(dbFilePath());

// Enable foreign keys; wait up to 5s on a briefly-locked DB instead of erroring
// immediately; WAL improves read/write concurrency for the single-file DB.
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

// Export schema for convenience
export * from "./schema";
