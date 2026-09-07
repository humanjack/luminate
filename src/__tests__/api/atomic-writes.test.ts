import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { NextRequest } from "next/server";
import * as schema from "@/lib/db/schema";
import { createTables } from "@/lib/db/migrations";

const state = vi.hoisted(() => ({ db: null as ReturnType<typeof drizzle> | null, stream: vi.fn() }));
vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual("@/lib/db/schema")),
  get db() { return state.db; },
}));
vi.mock("@/lib/llm/anthropicClient", () => ({
  createAnthropicClient: () => ({ messages: { stream: state.stream } }),
}));
import { runAgent } from "@/lib/agent/runner";
import { POST as saveSlides } from "@/app/api/projects/[id]/slides/route";
import { POST as saveScripts } from "@/app/api/projects/[id]/scripts/route";
import { POST as saveOutline } from "@/app/api/projects/[id]/outline/route";
import { POST as saveClaims } from "@/app/api/projects/[id]/claims/route";
import { POST as generateThumbnails, PATCH as selectThumbnail } from "@/app/api/projects/[id]/thumbnails/route";

let sqlite: Database.Database;
const params = Promise.resolve({ id: "p1" });
function request(body: unknown, method = "POST") {
  return new NextRequest("http://localhost/api/projects/p1/slides", {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}
beforeEach(() => {
  state.stream.mockReset();
  sqlite = new Database(":memory:");
  createTables(sqlite);
  state.db = drizzle(sqlite, { schema });
  const now = new Date();
  state.db.insert(schema.projects).values({ id: "p1", name: "Project", currentStep: 2, createdAt: now, updatedAt: now }).run();
  state.db.insert(schema.slides).values({ id: "old-slide", projectId: "p1", index: 0, markdown: "Old slide", createdAt: now, updatedAt: now }).run();
  state.db.insert(schema.scripts).values({ id: "old-script", projectId: "p1", slideId: "old-slide", slideIndex: 0, text: "Old script", createdAt: now, updatedAt: now }).run();
});
afterEach(() => { sqlite.close(); vi.restoreAllMocks(); });

describe("atomic project writes", () => {
  it("replaces slides and advances the project together", async () => {
    const response = await saveSlides(request({ slides: [{ id: "new-slide", markdown: "New slide" }] }), { params });
    expect(response.status).toBe(200);
    expect(state.db!.select().from(schema.slides).all().map(row => row.id)).toEqual(["new-slide"]);
    expect(state.db!.select().from(schema.projects).get()?.currentStep).toBe(4);
  });

  it("preserves previous slides, dependent scripts, and project step when a later insert fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await saveSlides(request({ slides: [{ markdown: "Valid" }, { markdown: null }] }), { params });
    expect(response.status).toBe(500);
    expect(state.db!.select().from(schema.slides).all().map(row => row.id)).toEqual(["old-slide"]);
    expect(state.db!.select().from(schema.scripts).all().map(row => row.id)).toEqual(["old-script"]);
    expect(state.db!.select().from(schema.projects).get()?.currentStep).toBe(2);
  });

  it("rolls back scripts when a later insert fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await saveScripts(request({ scripts: [
      { slideId: "old-slide", slideIndex: 0, text: "New script" },
      { slideId: "old-slide", slideIndex: 1, text: null },
    ] }), { params });
    expect(response.status).toBe(500);
    expect(state.db!.select().from(schema.scripts).all().map(row => row.text)).toEqual(["Old script"]);
    expect(state.db!.select().from(schema.projects).get()?.currentStep).toBe(2);
  });

  it.each(["outline", "claims"])("preserves previous %s on a duplicate-id replacement failure", async (kind) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = kind === "outline" ? saveOutline : saveClaims;
    const item = kind === "outline" ? { title: "Old", index: 0, approved: true } : { text: "Old" };
    await handler(request({ items: [{ ...item, id: "original" }] }), { params });
    const response = await handler(request({ items: [{ ...item, id: "duplicate" }, { ...item, id: "duplicate" }] }), { params });
    expect(response.status).toBe(500);
    const rows = kind === "outline" ? state.db!.select().from(schema.outlineItems).all() : state.db!.select().from(schema.claims).all();
    expect(rows.map(row => row.id)).toEqual(["original"]);
  });

  it("selects exactly one thumbnail and rejects a missing preset without losing the selection", async () => {
    await generateThumbnails(request({}), { params });
    const rows = state.db!.select().from(schema.thumbnails).all();
    const selected = await selectThumbnail(request({ preset: rows[1].preset }, "PATCH"), { params });
    expect(selected.status).toBe(200);
    expect(state.db!.select().from(schema.thumbnails).all().filter(row => row.selected).map(row => row.id)).toEqual([rows[1].id]);
    const invalid = await selectThumbnail(request({ preset: "missing" }, "PATCH"), { params });
    expect(invalid.status).toBe(404);
    expect(state.db!.select().from(schema.thumbnails).all().filter(row => row.selected).map(row => row.id)).toEqual([rows[1].id]);
  });

  it("rolls back thumbnail selection if the chosen row cannot be updated", async () => {
    await generateThumbnails(request({}), { params });
    const rows = state.db!.select().from(schema.thumbnails).all();
    await selectThumbnail(request({ preset: rows[0].preset }, "PATCH"), { params });
    sqlite.exec("CREATE TRIGGER fail_selection BEFORE UPDATE ON thumbnails WHEN NEW.selected = 1 BEGIN SELECT RAISE(ABORT, 'selection failure'); END;");
    await expect(selectThumbnail(request({ preset: rows[1].preset }, "PATCH"), { params })).rejects.toThrow("selection failure");
    expect(state.db!.select().from(schema.thumbnails).all().filter(row => row.selected).map(row => row.id)).toEqual([rows[0].id]);
  });

  it("preserves all thumbnail variants if regeneration fails after its first insert", async () => {
    await generateThumbnails(request({}), { params });
    const previous = state.db!.select().from(schema.thumbnails).all();
    sqlite.exec("CREATE TRIGGER fail_regeneration BEFORE INSERT ON thumbnails WHEN (SELECT count(*) FROM thumbnails) > 0 BEGIN SELECT RAISE(ABORT, 'regeneration failure'); END;");
    await expect(generateThumbnails(request({}), { params })).rejects.toThrow("regeneration failure");
    expect(state.db!.select().from(schema.thumbnails).all()).toEqual(previous);
  });

  it("rolls back replacement slides when the project step update fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    sqlite.exec("CREATE TRIGGER fail_step BEFORE UPDATE OF current_step ON projects BEGIN SELECT RAISE(ABORT, 'step failure'); END;");
    const response = await saveSlides(request({ slides: [{ markdown: "New" }] }), { params });
    expect(response.status).toBe(500);
    expect(state.db!.select().from(schema.slides).all().map(row => row.id)).toEqual(["old-slide"]);
    expect(state.db!.select().from(schema.scripts).all().map(row => row.id)).toEqual(["old-script"]);
  });

  it.each(["failure", "cancel", "success"])("keeps existing scripts until all agent generation finishes (%s)", async (outcome) => {
    const now = new Date();
    state.db!.insert(schema.slides).values({ id: "second-slide", projectId: "p1", index: 1, markdown: "Second", createdAt: now, updatedAt: now }).run();
    const controller = new AbortController();
    let calls = 0;
    state.stream.mockImplementation(async () => {
      calls++;
      expect(sqlite.inTransaction).toBe(false);
      expect(state.db!.select().from(schema.scripts).all().map(row => row.text)).toEqual(["Old script"]);
      if (calls === 2 && outcome === "failure") throw new Error("LLM failed");
      if (calls === 2 && outcome === "cancel") controller.abort();
      return (async function* () {
        yield { type: "content_block_delta", delta: { type: "text_delta", text: "Generated script" } };
      })();
    });
    const events = [];
    for await (const event of runAgent({ projectId: "p1", apiKey: "test", model: "claude-sonnet-4-5", fromStep: "scripts", toStep: "scripts" }, controller.signal)) events.push(event);
    expect(calls).toBe(2);
    if (outcome === "success") {
      expect(events.some(event => event.type === "run_completed")).toBe(true);
      expect(state.db!.select().from(schema.scripts).all().map(row => row.text)).toEqual(["Generated script", "Generated script"]);
      expect(state.db!.select().from(schema.projects).get()?.currentStep).toBe(5);
    } else {
      expect(events.some(event => event.type === "run_error")).toBe(true);
      expect(state.db!.select().from(schema.scripts).all().map(row => row.text)).toEqual(["Old script"]);
      expect(state.db!.select().from(schema.projects).get()?.currentStep).toBe(2);
    }
  });

});
