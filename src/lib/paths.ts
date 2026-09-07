import path from "path";

/**
 * Filesystem roots, resolved once from the environment so a containerized or
 * read-only-filesystem deploy can redirect persistent state to a mounted
 * volume. Defaults are byte-for-byte identical to the previous hardcoded
 * `process.cwd()`-based paths, so unset behavior is unchanged.
 *
 *   LUMINATE_DATA_DIR  — root for the SQLite DB (and, when set, media). Default cwd.
 *
 * Web-facing stored paths (`/recordings/...`, `/exports/...`) are unchanged.
 */
export function dataDir(): string {
  return process.env.LUMINATE_DATA_DIR || process.cwd();
}

/** Absolute path to the SQLite database file. */
export function dbFilePath(): string {
  return path.join(dataDir(), "luminate.db");
}

/**
 * Root under which media (recordings, exports) is written. Defaults to
 * `<cwd>/public` to preserve Next.js static-serving semantics when
 * LUMINATE_DATA_DIR is unset. When LUMINATE_DATA_DIR IS set (a mounted volume),
 * media lives under it. The /recordings and /exports route handlers serve new
 * files from this root, including files created after a standalone build.
 */
export function mediaRoot(): string {
  return process.env.LUMINATE_DATA_DIR
    ? path.join(process.env.LUMINATE_DATA_DIR, "media")
    : path.join(process.cwd(), "public");
}
