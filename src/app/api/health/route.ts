import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness probe — process is up and serving. Does NOT touch the database
 * (that's /api/ready). Suitable for a load-balancer/orchestrator liveness check.
 */
export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
