import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// In-memory store mocked for both POST and DELETE
type RecordingRow = {
  id: string;
  projectId: string;
  slideIndex?: number;
  slideId?: string;
  audioPath: string;
  duration: number;
  waveformData?: number[];
  createdAt: Date;
};

const state: { rows: RecordingRow[]; files: Map<string, Buffer> } = {
  rows: [],
  files: new Map(),
};

vi.mock("@/lib/db", () => {
  // Tiny tagged query helpers used to identify operations in the mock
  const cond = (kind: string, key: string, value: unknown) => ({
    kind,
    key,
    value,
  });

  return {
    db: {
      select: () => ({
        from: (_table: unknown) => ({
          where: (c: ReturnType<typeof cond>) => {
            if (c.kind === "eq") {
              return Promise.resolve(
                state.rows.filter(
                  (r) => (r as Record<string, unknown>)[c.key as string] === c.value
                )
              );
            }
            if (c.kind === "and") {
              const conds = c.value as ReturnType<typeof cond>[];
              return Promise.resolve(
                state.rows.filter((r) =>
                  conds.every(
                    (cc) =>
                      (r as Record<string, unknown>)[cc.key as string] === cc.value
                  )
                )
              );
            }
            return Promise.resolve([]);
          },
        }),
      }),
      insert: () => ({
        values: (row: RecordingRow) => ({
          returning: () => {
            state.rows.push(row);
            return Promise.resolve([row]);
          },
        }),
      }),
      update: () => ({
        set: () => ({ where: () => Promise.resolve() }),
      }),
      delete: () => ({
        where: (c: ReturnType<typeof cond>) => {
          if (c.kind === "eq") {
            state.rows = state.rows.filter(
              (r) => (r as Record<string, unknown>)[c.key as string] !== c.value
            );
          }
          return Promise.resolve();
        },
      }),
    },
    recordings: {
      id: "id",
      projectId: "projectId",
      slideIndex: "slideIndex",
      audioPath: "audioPath",
    },
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

vi.mock("uuid", () => {
  let n = 0;
  return { v4: () => `rec-${++n}` };
});

const writes: Array<{ path: string; size: number }> = [];
const unlinks: string[] = [];
vi.mock("fs/promises", () => {
  const writeFile = vi.fn(async (p: string, data: Buffer) => {
    state.files.set(p, data);
    writes.push({ path: p, size: data.byteLength });
  });
  const mkdir = vi.fn(async () => undefined);
  const unlink = vi.fn(async (p: string) => {
    state.files.delete(p);
    unlinks.push(p);
  });
  return {
    default: { writeFile, mkdir, unlink },
    writeFile,
    mkdir,
    unlink,
  };
});

import { POST, GET, DELETE } from "@/app/api/projects/[id]/recordings/route";
import { DELETE as DELETE_ONE } from "@/app/api/recordings/[id]/route";

function req(method: string, body?: unknown) {
  const url = "http://test.local/api/projects/p1/recordings";
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

const params = Promise.resolve({ id: "p1" });

beforeEach(() => {
  state.rows = [];
  state.files.clear();
  writes.length = 0;
  unlinks.length = 0;
});

const TINY_WEBM_B64 = Buffer.from("hello world").toString("base64");

describe("recordings API (#2 durable persistence)", () => {
  it("rejects an empty recording (no audioData, no audioPath)", async () => {
    const r = await POST(req("POST", { slideIndex: 0, duration: 1 }), { params });
    expect(r.status).toBe(400);
  });

  it("rejects a recording with zero duration", async () => {
    const r = await POST(
      req("POST", { slideIndex: 0, duration: 0, audioData: TINY_WEBM_B64 }),
      { params }
    );
    expect(r.status).toBe(400);
  });

  it("persists audio bytes to public/recordings/<project>/<id>.webm", async () => {
    const r = await POST(
      req("POST", { slideIndex: 0, duration: 5.2, audioData: TINY_WEBM_B64 }),
      { params }
    );
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.audioPath).toMatch(/^\/recordings\/p1\/rec-\d+\.webm$/);
    expect(body.duration).toBe(5.2);
    expect(writes.length).toBe(1);
    expect(writes[0].size).toBe(Buffer.from("hello world").byteLength);
  });

  it("replaces an existing recording for the same slide and removes the old file", async () => {
    await POST(
      req("POST", { slideIndex: 0, duration: 3, audioData: TINY_WEBM_B64 }),
      { params }
    );
    const list1 = state.rows.filter((r) => r.slideIndex === 0);
    expect(list1.length).toBe(1);
    const firstPath = list1[0].audioPath;

    await POST(
      req("POST", {
        slideIndex: 0,
        duration: 4,
        audioData: Buffer.from("v2 data").toString("base64"),
      }),
      { params }
    );

    const list2 = state.rows.filter((r) => r.slideIndex === 0);
    expect(list2.length).toBe(1);
    expect(list2[0].audioPath).not.toBe(firstPath);
    expect(unlinks.some((p) => p.endsWith(firstPath))).toBe(true);
  });

  it("GET returns all recordings for the project", async () => {
    await POST(
      req("POST", { slideIndex: 0, duration: 1, audioData: TINY_WEBM_B64 }),
      { params }
    );
    await POST(
      req("POST", { slideIndex: 1, duration: 1, audioData: TINY_WEBM_B64 }),
      { params }
    );
    const r = await GET(req("GET"), { params });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.length).toBe(2);
  });

  it("DELETE /api/recordings/[id] removes the row and its audio file", async () => {
    await POST(
      req("POST", { slideIndex: 0, duration: 1, audioData: TINY_WEBM_B64 }),
      { params }
    );
    const [created] = state.rows;
    const filePath = created.audioPath;

    const single = new NextRequest("http://test.local/api/recordings/" + created.id, {
      method: "DELETE",
    });
    const r = await DELETE_ONE(single, { params: Promise.resolve({ id: created.id }) });
    expect(r.status).toBe(200);
    expect(state.rows.length).toBe(0);
    expect(unlinks.some((p) => p.endsWith(filePath))).toBe(true);
  });

  it("DELETE /api/projects/[id]/recordings removes all + their files", async () => {
    await POST(
      req("POST", { slideIndex: 0, duration: 1, audioData: TINY_WEBM_B64 }),
      { params }
    );
    await POST(
      req("POST", { slideIndex: 1, duration: 1, audioData: TINY_WEBM_B64 }),
      { params }
    );
    expect(state.rows.length).toBe(2);
    const r = await DELETE(req("DELETE"), { params });
    expect(r.status).toBe(200);
    expect(state.rows.length).toBe(0);
    expect(unlinks.length).toBeGreaterThanOrEqual(2);
  });
});
