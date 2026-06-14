import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { dbFilePath } from "@/lib/paths";

const sqlite = new Database(dbFilePath());

// Enable foreign keys
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Export schema for convenience
export * from "./schema";
