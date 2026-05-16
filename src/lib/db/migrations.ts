import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "luminate.db");

export function initializeDatabase() {
  const sqlite = new Database(dbPath);

  // Enable foreign keys
  sqlite.pragma("foreign_keys = ON");

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
  `);

  // Idempotent column adds for existing databases
  applyColumnIfMissing(sqlite, "slides", "source_refs", "TEXT");
  applyColumnIfMissing(sqlite, "slides", "outline_item_id", "TEXT");
  applyColumnIfMissing(sqlite, "scripts", "source_refs", "TEXT");

  sqlite.close();
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
