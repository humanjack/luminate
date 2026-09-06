import Database from "better-sqlite3";
import { dbFilePath } from "@/lib/paths";

const dbPath = dbFilePath();

/** The full set of tables the app's DDL provisions. */
export const EXPECTED_TABLES = [
  "projects",
  "research_data",
  "content_data",
  "slides",
  "scripts",
  "recordings",
  "analysis_results",
  "videos",
  "sources",
  "claims",
  "outline_items",
  "exports",
  "settings",
  "agent_runs",
  "agent_steps",
  "video_metadata",
  "thumbnails",
  "clip_suggestions",
] as const;

/** Diff the live schema against EXPECTED_TABLES. */
export function verifySchema(sqlite: Database.Database): {
  ok: boolean;
  present: string[];
  missing: string[];
} {
  const rows = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as Array<{ name: string }>;
  const live = new Set(rows.map((r) => r.name));
  const present = EXPECTED_TABLES.filter((t) => live.has(t));
  const missing = EXPECTED_TABLES.filter((t) => !live.has(t));
  return { ok: missing.length === 0, present, missing };
}

/**
 * Provision the database (idempotent). Opens a connection separate from the
 * long-lived app singleton, sets concurrency-friendly pragmas, runs the DDL,
 * and verifies all expected tables exist before reporting success. Returns the
 * number of tables verified.
 */
export function initializeDatabase(): number {
  const sqlite = new Database(dbPath);
  try {
    sqlite.pragma("busy_timeout = 5000");
    sqlite.pragma("journal_mode = WAL");
    createTables(sqlite);
    const check = verifySchema(sqlite);
    if (!check.ok) {
      throw new Error(
        `Schema verification failed — missing tables: ${check.missing.join(", ")}`
      );
    }
    return check.present.length;
  } finally {
    sqlite.close();
  }
}

// Creates the full schema on the given connection. Exported so tests can
// build an in-memory database from the exact DDL the app runs.
export function createTables(sqlite: Database.Database) {
  // Enable foreign keys + wait (rather than immediately erroring) if the DB is
  // briefly locked by a concurrent hot-DB request.
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  // Create tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      current_step INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'in_progress', 'completed')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS research_data (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      topic TEXT NOT NULL,
      depth TEXT NOT NULL DEFAULT 'detailed' CHECK(depth IN ('quick', 'detailed', 'comprehensive')),
      content TEXT,
      sources TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content_data (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT,
      format TEXT NOT NULL DEFAULT 'presentation' CHECK(format IN ('presentation', 'tutorial', 'explainer')),
      target_length INTEGER NOT NULL DEFAULT 10,
      outline TEXT,
      markdown TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS slides (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      "index" INTEGER NOT NULL,
      markdown TEXT NOT NULL,
      image_data TEXT,
      theme TEXT DEFAULT 'default',
      source_refs TEXT,
      outline_item_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      slide_id TEXT REFERENCES slides(id) ON DELETE CASCADE,
      slide_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      speaker_notes TEXT,
      estimated_duration INTEGER,
      source_refs TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      slide_id TEXT REFERENCES slides(id) ON DELETE CASCADE,
      slide_index INTEGER,
      audio_path TEXT NOT NULL,
      audio_data BLOB,
      duration REAL,
      waveform_data TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analysis_results (
      id TEXT PRIMARY KEY,
      recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      overall_score REAL,
      pronunciation_score REAL,
      fluency_score REAL,
      confidence_score REAL,
      naturalness_score REAL,
      words_per_minute REAL,
      filler_words TEXT,
      segments TEXT,
      recommendations TEXT,
      transcript TEXT,
      diff TEXT,
      provider TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      output_path TEXT,
      duration REAL,
      resolution TEXT DEFAULT '1920x1080',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
      progress INTEGER DEFAULT 0,
      youtube_url TEXT,
      youtube_video_id TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('url', 'text', 'manual')),
      url TEXT,
      title TEXT,
      author TEXT,
      published_at TEXT,
      fetched_text TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'fetched', 'approved', 'rejected', 'failed')),
      trust_notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      source_ids TEXT NOT NULL DEFAULT '[]',
      pinned INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'proposed'
        CHECK(status IN ('proposed', 'approved', 'rejected')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS outline_items (
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

    CREATE TABLE IF NOT EXISTS exports (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      video_id TEXT REFERENCES videos(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'rendering', 'encoding', 'completed', 'failed')),
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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'idle'
        CHECK(status IN ('idle', 'running', 'paused', 'completed', 'error', 'cancelled')),
      from_step TEXT NOT NULL,
      to_step TEXT NOT NULL,
      current_step TEXT,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      error_message TEXT,
      started_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS agent_steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
      step TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'running', 'completed', 'error', 'skipped')),
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      duration_ms INTEGER,
      error_message TEXT,
      started_at INTEGER,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS video_metadata (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      titles TEXT NOT NULL DEFAULT '[]',
      selected_title_index INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS thumbnails (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      preset TEXT NOT NULL
        CHECK(preset IN ('bold-text', 'question', 'numbered-list', 'reaction')),
      svg TEXT NOT NULL,
      selected INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clip_suggestions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      start_sec REAL NOT NULL,
      end_sec REAL NOT NULL,
      hook TEXT NOT NULL,
      virality_score INTEGER NOT NULL,
      reasoning TEXT,
      status TEXT NOT NULL DEFAULT 'suggested'
        CHECK(status IN ('suggested', 'kept', 'discarded')),
      created_at INTEGER NOT NULL
    );

    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_research_project ON research_data(project_id);
    CREATE INDEX IF NOT EXISTS idx_content_project ON content_data(project_id);
    CREATE INDEX IF NOT EXISTS idx_slides_project ON slides(project_id);
    CREATE INDEX IF NOT EXISTS idx_scripts_project ON scripts(project_id);
    CREATE INDEX IF NOT EXISTS idx_recordings_project ON recordings(project_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_project ON analysis_results(project_id);
    CREATE INDEX IF NOT EXISTS idx_videos_project ON videos(project_id);
    CREATE INDEX IF NOT EXISTS idx_sources_project ON sources(project_id);
    CREATE INDEX IF NOT EXISTS idx_claims_project ON claims(project_id);
    CREATE INDEX IF NOT EXISTS idx_outline_items_project ON outline_items(project_id);
    CREATE INDEX IF NOT EXISTS idx_exports_project ON exports(project_id);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_project ON agent_runs(project_id);
    CREATE INDEX IF NOT EXISTS idx_agent_steps_run ON agent_steps(run_id);
    CREATE INDEX IF NOT EXISTS idx_video_metadata_project ON video_metadata(project_id);
    CREATE INDEX IF NOT EXISTS idx_thumbnails_project ON thumbnails(project_id);
    CREATE INDEX IF NOT EXISTS idx_clip_suggestions_project ON clip_suggestions(project_id);

    -- Hot path: GET /api/projects enriches every card with the first slide
    -- (slides.index = 0) and the selected thumbnail across ALL projects. These
    -- turn the prior full-table SCANs into index lookups.
    -- Partial index matches the WHERE "index" = 0 predicate (tiny: one row/project).
    CREATE INDEX IF NOT EXISTS idx_slides_first ON slides(project_id) WHERE "index" = 0;
    -- Composite for the per-project ordered fetch (WHERE project_id = ? ORDER BY index).
    CREATE INDEX IF NOT EXISTS idx_slides_project_index ON slides(project_id, "index");
    -- Partial index over only selected thumbnails.
    CREATE INDEX IF NOT EXISTS idx_thumbnails_selected ON thumbnails(project_id) WHERE selected = 1;
  `);

  // Idempotent column adds for existing databases
  applyColumnIfMissing(sqlite, "slides", "source_refs", "TEXT");
  applyColumnIfMissing(sqlite, "slides", "outline_item_id", "TEXT");
  applyColumnIfMissing(sqlite, "scripts", "source_refs", "TEXT");
  applyColumnIfMissing(sqlite, "analysis_results", "transcript", "TEXT");
  applyColumnIfMissing(sqlite, "analysis_results", "diff", "TEXT");
  applyColumnIfMissing(sqlite, "analysis_results", "provider", "TEXT");
}

function applyColumnIfMissing(
  sqlite: Database.Database,
  table: string,
  column: string,
  type: string
) {
  const cols = sqlite
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
  }
}
