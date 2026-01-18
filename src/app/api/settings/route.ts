import { NextRequest, NextResponse } from "next/server";
import { db, settings } from "@/lib/db";
import { eq } from "drizzle-orm";

// GET /api/settings - Get all settings
export async function GET() {
  try {
    const allSettings = await db.select().from(settings);

    // Convert array to object
    const settingsObject: Record<string, any> = {};
    for (const setting of allSettings) {
      try {
        settingsObject[setting.key] = JSON.parse(setting.value || "null");
      } catch {
        settingsObject[setting.key] = setting.value;
      }
    }

    return NextResponse.json(settingsObject);
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// POST /api/settings - Save settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const now = new Date();

    for (const [key, value] of Object.entries(body)) {
      const stringValue = typeof value === "string" ? value : JSON.stringify(value);

      // Check if setting exists
      const [existing] = await db.select().from(settings).where(eq(settings.key, key));

      if (existing) {
        await db
          .update(settings)
          .set({ value: stringValue, updatedAt: now })
          .where(eq(settings.key, key));
      } else {
        await db.insert(settings).values({
          key,
          value: stringValue,
          updatedAt: now,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
