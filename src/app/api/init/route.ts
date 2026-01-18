import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/migrations";

// GET /api/init - Initialize the database
export async function GET() {
  try {
    initializeDatabase();
    return NextResponse.json({ success: true, message: "Database initialized" });
  } catch (error) {
    console.error("Database initialization failed:", error);
    return NextResponse.json(
      { error: "Database initialization failed", details: (error as Error).message },
      { status: 500 }
    );
  }
}
