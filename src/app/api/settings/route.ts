import { NextRequest, NextResponse } from "next/server";
import { db, settings } from "@/lib/db";
import { eq } from "drizzle-orm";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// GET /api/settings - Get all settings (from local DB + sync with backend)
export async function GET() {
  try {
    // Get local settings
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

// POST /api/settings - Save settings (to local DB + sync to backend)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const now = new Date();

    // Save to local SQLite
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

    // Sync LLM-related settings to backend
    const llmSettings = {
      llmProvider: body.llmProvider,
      anthropicApiKey: body.anthropicApiKey,
      claudeModel: body.claudeModel,
      openaiApiKey: body.openaiApiKey,
      openaiModel: body.openaiModel,
      googleApiKey: body.googleApiKey,
      googleModel: body.googleModel,
    };

    // Filter out undefined values
    const filteredSettings = Object.fromEntries(
      Object.entries(llmSettings).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(filteredSettings).length > 0) {
      console.log(`[Settings] Syncing to backend: ${BACKEND_URL}/api/settings`);
      try {
        await fetch(`${BACKEND_URL}/api/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(filteredSettings),
        });
      } catch (backendError) {
        console.error("[Settings] Failed to sync to backend:", backendError);
        // Don't fail the request if backend sync fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
