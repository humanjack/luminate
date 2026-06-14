import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  recordings: [] as Array<{ id: string; audioPath: string }>,
  settings: [] as Array<{ key: string; value: string }>,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: (t: { __t: string }) => {
        const rows = t.__t === "settings" ? h.settings : h.recordings;
        // Awaitable directly (getSettings) AND has .where (recording lookup).
        const p = Promise.resolve(rows) as Promise<unknown> & {
          where?: (c: { value: unknown }) => Promise<unknown>;
        };
        p.where = (c: { value: unknown }) =>
          Promise.resolve(
            (rows as Array<{ id?: string }>).filter((r) => r.id === c.value)
          );
        return p;
      },
    }),
  },
  settings: { __t: "settings" },
  recordings: { __t: "recordings", id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (_col: unknown, value: unknown) => ({ value }),
}));

import { POST } from "@/app/api/speech/analyze/route";

function req(body: unknown) {
  return new NextRequest("http://test.local/api/speech/analyze", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  h.recordings = [];
  h.settings = [];
});

describe("speech/analyze route", () => {
  it("returns 400 when recordingId is missing", async () => {
    const r = await POST(req({ script: "hi" }));
    expect(r.status).toBe(400);
  });

  it("returns 404 when the recording does not exist", async () => {
    const r = await POST(req({ recordingId: "nope", audioPath: "/etc/passwd" }));
    expect(r.status).toBe(404);
  });

  it("uses the stored recording (ignoring any client audioPath) and returns a mock result for the default provider", async () => {
    h.recordings = [{ id: "rec1", audioPath: "/recordings/p1/rec1.webm" }];
    // Client tries to smuggle a traversal path — it must be ignored.
    const r = await POST(req({ recordingId: "rec1", audioPath: "/etc/passwd", script: "s" }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.recordingId).toBe("rec1");
    expect(body.provider).toBe("mock");
  });
});
