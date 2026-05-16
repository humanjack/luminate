import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// In-memory rows for outline_items + a tiny "projects" tracker
type OutlineRow = {
  id: string;
  projectId: string;
  index: number;
  title: string;
  summary: string | null;
  speakerGoal: string | null;
  claimIds: string[];
  approved: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const state: {
  outline: OutlineRow[];
  projectStep: Map<string, number>;
} = {
  outline: [],
  projectStep: new Map(),
};

vi.mock("@/lib/db", () => {
  const cond = (kind: string, key: string, value: unknown) => ({ kind, key, value });

  return {
    db: {
      select: () => ({
        from: () => ({
          where: (c: ReturnType<typeof cond>) => {
            if (c.kind === "eq") {
              return Promise.resolve(
                state.outline.filter(
                  (r) => (r as Record<string, unknown>)[c.key] === c.value
                )
              );
            }
            return Promise.resolve([]);
          },
        }),
      }),
      insert: () => ({
        values: (rows: OutlineRow | OutlineRow[]) => {
          const arr = Array.isArray(rows) ? rows : [rows];
          state.outline.push(...arr);
          return Promise.resolve(arr);
        },
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => ({
          where: (c: ReturnType<typeof cond>) => {
            if (c.kind === "eq" && c.key === "id" && typeof patch.currentStep === "number") {
              state.projectStep.set(c.value as string, patch.currentStep);
            }
            return Promise.resolve();
          },
        }),
      }),
      delete: () => ({
        where: (c: ReturnType<typeof cond>) => {
          if (c.kind === "eq") {
            state.outline = state.outline.filter(
              (r) => (r as Record<string, unknown>)[c.key] !== c.value
            );
          }
          return Promise.resolve();
        },
      }),
    },
    outlineItems: { id: "id", projectId: "projectId", index: "index" },
    projects: { id: "id" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, value: unknown) => ({
    kind: "eq",
    key: typeof col === "string" ? col : "id",
    value,
  }),
  and: (...conds: unknown[]) => ({ kind: "and", key: "", value: conds }),
}));

let uuidCounter = 0;
vi.mock("uuid", () => ({
  v4: () => `oi-${++uuidCounter}`,
}));

import {
  POST,
  GET,
  DELETE,
} from "@/app/api/projects/[id]/outline/route";

function req(method: string, body?: unknown) {
  const url = "http://test.local/api/projects/p1/outline";
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

const params = Promise.resolve({ id: "p1" });

beforeEach(() => {
  state.outline = [];
  state.projectStep.clear();
  uuidCounter = 0;
});

describe("outline API (#5)", () => {
  it("POST rejects items with empty titles", async () => {
    const r = await POST(
      req("POST", { items: [{ index: 0, title: "" }] }),
      { params }
    );
    expect(r.status).toBe(400);
  });

  it("POST rejects items with negative index", async () => {
    const r = await POST(
      req("POST", { items: [{ index: -1, title: "Intro" }] }),
      { params }
    );
    expect(r.status).toBe(400);
  });

  it("POST persists items in index order with their fields", async () => {
    const r = await POST(
      req("POST", {
        items: [
          { index: 1, title: "Body", summary: "B", speakerGoal: "G", claimIds: [] },
          { index: 0, title: "Intro", approved: false },
        ],
      }),
      { params }
    );
    expect(r.status).toBe(200);
    const body = (await r.json()) as Array<{ index: number; title: string }>;
    expect(body.map((b) => b.title)).toEqual(["Intro", "Body"]);
  });

  it("POST advances the project to slides step only when ALL items approved", async () => {
    await POST(
      req("POST", {
        items: [
          { index: 0, title: "Intro", approved: true },
          { index: 1, title: "Body", approved: false },
        ],
      }),
      { params }
    );
    expect(state.projectStep.get("p1")).toBeUndefined();

    await POST(
      req("POST", {
        items: [
          { index: 0, title: "Intro", approved: true },
          { index: 1, title: "Body", approved: true },
        ],
      }),
      { params }
    );
    expect(state.projectStep.get("p1")).toBe(3);
  });

  it("POST replaces the prior outline instead of appending", async () => {
    await POST(
      req("POST", {
        items: [
          { index: 0, title: "A" },
          { index: 1, title: "B" },
        ],
      }),
      { params }
    );
    expect(state.outline.length).toBe(2);
    await POST(
      req("POST", { items: [{ index: 0, title: "C" }] }),
      { params }
    );
    expect(state.outline.length).toBe(1);
    expect(state.outline[0].title).toBe("C");
  });

  it("GET returns items in index order", async () => {
    await POST(
      req("POST", {
        items: [
          { index: 2, title: "C" },
          { index: 0, title: "A" },
          { index: 1, title: "B" },
        ],
      }),
      { params }
    );
    const r = await GET(req("GET"), { params });
    expect(r.status).toBe(200);
    const body = (await r.json()) as Array<{ title: string }>;
    expect(body.map((b) => b.title)).toEqual(["A", "B", "C"]);
  });

  it("DELETE clears the outline for the project", async () => {
    await POST(
      req("POST", { items: [{ index: 0, title: "A" }] }),
      { params }
    );
    expect(state.outline.length).toBe(1);
    const r = await DELETE(req("DELETE"), { params });
    expect(r.status).toBe(200);
    expect(state.outline.length).toBe(0);
  });
});
