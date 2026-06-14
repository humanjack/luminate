import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Readiness probe — the app can serve traffic, including a live DB check
 * (`SELECT 1`). Returns 200 when the SQLite connection answers, 503 otherwise,
 * so an orchestrator can hold traffic off an instance with a missing/locked/
 * corrupt database.
 */
export async function GET() {
  try {
    db.run(sql`SELECT 1`);
    return NextResponse.json(
      { status: "ok", checks: { db: "ok" }, timestamp: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    log.error("Readiness DB check failed", { err: error, route: "/api/ready" });
    return NextResponse.json(
      { status: "error", checks: { db: "down" }, timestamp: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
