import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

type SourceRow = {
  id: string;
  projectId: string;
  type: "url" | "text" | "manual";
  url: string | null;
  title: string | null;
  status: "pending" | "fetched" | "approved" | "rejected" | "failed";
  fetchedText: string | null;
  createdAt: Date;
  updatedAt: Date;
};
type ClaimRow = {
  id: string;
  projectId: string;
  text: string;
  sourceIds: string[];
  pinned: boolean;
  status: "proposed" | "approved" | "rejected";
};

const state: { sources: SourceRow[]; claims: ClaimRow[] } = {
  sources: [],
  claims: [],
};

vi.mock("@/lib/db", () => {
  const TABLE_SOURCES = { __table: "sources", id: "id", projectId: "projectId" };
  const TABLE_CLAIMS = { __table: "claims", id: "id", projectId: "projectId" };
  const cond = (kind: string, key: string, value: unknown) => ({ kind, key, value });
  return {
    db: {
      select: () => ({
        from: (table: { __table: string }) => ({
          where: (c: ReturnType<typeof cond>) => {
            const which =
              table.__table === "sources" ? state.sources : state.claims;
            if (c.kind === "eq") {
              return Promise.resolve(
                which.filter(
                  (r) => (r as Record<string, unknown>)[c.key] === c.value
                )
              );
            }
            return Promise.resolve([]);
          },
        }),
      }),
      insert: (table: { __table: string }) => ({
        values: (rows: SourceRow | SourceRow[] | ClaimRow | ClaimRow[]) => {
          const arr = Array.isArray(rows) ? rows : [rows];
          if (table.__table === "sources")
            state.sources.push(...(arr as SourceRow[]));
          else state.claims.push(...(arr as ClaimRow[]));
          return {
            returning: () => Promise.resolve(arr),
          };
        },
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve(state.sources),
          }),
        }),
      }),
      delete: (table: { __table: string }) => ({
        where: (c: ReturnType<typeof cond>) => {
          const removeFrom: "sources" | "claims" =
            table.__table === "sources" ? "sources" : "claims";
          if (c.kind === "eq") {
            state[removeFrom] = state[removeFrom].filter(
              (r) => (r as Record<string, unknown>)[c.key] !== c.value
            ) as never;
          }
          return Promise.resolve();
        },
      }),
    },
    sources: TABLE_SOURCES,
    claims: TABLE_CLAIMS,
  };
});

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, value: unknown) => ({
    kind: "eq",
    key: typeof col === "string" ? col : "id",
    value,
  }),
}));

let uuidCounter = 0;
vi.mock("uuid", () => ({ v4: () => `id-${++uuidCounter}` }));

// Stub global fetch for URL ingestion
const originalFetch = global.fetch;

import { POST as POST_SRC, GET as GET_SRC } from "@/app/api/projects/[id]/sources/route";
import { POST as POST_CL, GET as GET_CL } from "@/app/api/projects/[id]/claims/route";

function req(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

const params = Promise.resolve({ id: "p1" });

beforeEach(() => {
  state.sources = [];
  state.claims = [];
  uuidCounter = 0;
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () =>
      `<html><head><title>Test Article</title></head><body>Body text.</body></html>`,
  })) as unknown as typeof fetch;
});

describe("sources API (#4)", () => {
  it("POST /sources for type=url fetches the page, strips HTML, stores fetched text and title", async () => {
    const r = await POST_SRC(
      req("http://test.local/api/projects/p1/sources", "POST", {
        type: "url",
        url: "https://example.com/post",
      }),
      { params }
    );
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.type).toBe("url");
    expect(body.url).toBe("https://example.com/post");
    expect(body.status).toBe("fetched");
    expect(body.title).toBe("Test Article");
    expect(body.fetchedText).toContain("Body text.");
  });

  it("POST /sources for type=url marks the source failed (not 500) when fetch fails", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const r = await POST_SRC(
      req("http://test.local/api/projects/p1/sources", "POST", {
        type: "url",
        url: "https://example.com/down",
      }),
      { params }
    );
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.status).toBe("failed");
  });

  it("POST /sources for type=text accepts pasted content and assigns a title from the first line", async () => {
    const r = await POST_SRC(
      req("http://test.local/api/projects/p1/sources", "POST", {
        type: "text",
        fetchedText: "Compact summary line one.\nMore body text.",
      }),
      { params }
    );
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.type).toBe("text");
    expect(body.status).toBe("fetched");
    expect(body.title).toBe("Compact summary line one.");
  });

  it("POST /sources rejects unknown types", async () => {
    const r = await POST_SRC(
      req("http://test.local/api/projects/p1/sources", "POST", { type: "bogus" }),
      { params }
    );
    expect(r.status).toBe(400);
  });

  it("GET /sources lists sources for the project", async () => {
    await POST_SRC(
      req("http://test.local/api/projects/p1/sources", "POST", {
        type: "text",
        fetchedText: "Hello",
      }),
      { params }
    );
    const r = await GET_SRC(req("http://test.local/api/projects/p1/sources", "GET"), {
      params,
    });
    const body = await r.json();
    expect(body.length).toBe(1);
  });
});

describe("claims API (#4)", () => {
  it("POST /claims rejects empty text", async () => {
    const r = await POST_CL(
      req("http://test.local/api/projects/p1/claims", "POST", {
        items: [{ text: "  " }],
      }),
      { params }
    );
    expect(r.status).toBe(400);
  });

  it("POST /claims rejects refs to unknown source ids", async () => {
    const r = await POST_CL(
      req("http://test.local/api/projects/p1/claims", "POST", {
        items: [{ text: "Claim", sourceIds: ["does-not-exist"] }],
      }),
      { params }
    );
    expect(r.status).toBe(400);
  });

  it("POST /claims atomically replaces claims and persists source links", async () => {
    // First add a source so we can refer to it
    await POST_SRC(
      req("http://test.local/api/projects/p1/sources", "POST", {
        type: "text",
        fetchedText: "data",
      }),
      { params }
    );
    const sid = state.sources[0].id;

    await POST_CL(
      req("http://test.local/api/projects/p1/claims", "POST", {
        items: [{ text: "Old" }],
      }),
      { params }
    );
    expect(state.claims.length).toBe(1);

    const r = await POST_CL(
      req("http://test.local/api/projects/p1/claims", "POST", {
        items: [
          { text: "Supported claim", sourceIds: [sid] },
          { text: "Unsupported claim" },
        ],
      }),
      { params }
    );
    expect(r.status).toBe(200);
    expect(state.claims.length).toBe(2);
    expect(state.claims[0].sourceIds).toEqual([sid]);
    expect(state.claims[1].sourceIds).toEqual([]);
  });

  it("GET /claims lists current claims", async () => {
    await POST_CL(
      req("http://test.local/api/projects/p1/claims", "POST", {
        items: [{ text: "Hi" }],
      }),
      { params }
    );
    const r = await GET_CL(req("http://test.local/api/projects/p1/claims", "GET"), {
      params,
    });
    const body = await r.json();
    expect(body.length).toBe(1);
    expect(body[0].text).toBe("Hi");
  });
});

afterAll();
function afterAll() {
  global.fetch = originalFetch;
}
