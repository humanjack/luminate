import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { SECRET_SENTINEL } from "@/lib/api/secrets";

const h = vi.hoisted(() => ({ rows: [] as Array<{ key: string; value: string }> }));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => {
        const p = Promise.resolve(h.rows) as Promise<unknown> & {
          where?: (c: { value: unknown }) => Promise<unknown>;
        };
        p.where = (c: { value: unknown }) =>
          Promise.resolve(h.rows.filter((r) => r.key === c.value));
        return p;
      },
    }),
    update: () => ({
      set: (vals: { value: string }) => ({
        where: (c: { value: unknown }) => {
          const row = h.rows.find((r) => r.key === c.value);
          if (row) row.value = vals.value;
          return Promise.resolve();
        },
      }),
    }),
    insert: () => ({
      values: (vals: { key: string; value: string }) => {
        h.rows.push({ key: vals.key, value: vals.value });
        return Promise.resolve();
      },
    }),
  },
  settings: { key: "key" },
}));

vi.mock("drizzle-orm", () => ({ eq: (_c: unknown, value: unknown) => ({ value }) }));

import { GET, POST } from "@/app/api/settings/route";

function postReq(body: unknown) {
  return new NextRequest("http://test.local/api/settings", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  h.rows = [];
  // Avoid a real backend-sync network call.
  global.fetch = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;
});

describe("GET /api/settings (secret redaction)", () => {
  it("never returns a raw secret value; replaces it with a sentinel + Configured flag", async () => {
    h.rows = [
      { key: "anthropicApiKey", value: "sk-ant-REALSECRET" },
      { key: "theme", value: '"dark"' },
    ];
    const res = await GET();
    const body = await res.json();
    const raw = JSON.stringify(body);

    expect(raw).not.toContain("sk-ant-REALSECRET");
    expect(body.anthropicApiKey).toBe(SECRET_SENTINEL);
    expect(body.anthropicApiKeyConfigured).toBe(true);
    expect(body.theme).toBe("dark"); // non-secret passes through
  });

  it("reports an unset secret as not configured", async () => {
    h.rows = [{ key: "openaiApiKey", value: "" }];
    const res = await GET();
    const body = await res.json();
    expect(body.openaiApiKey).toBe("");
    expect(body.openaiApiKeyConfigured).toBe(false);
  });
});

describe("POST /api/settings (sentinel passthrough)", () => {
  it("leaves a stored secret untouched when the sentinel is posted back", async () => {
    h.rows = [{ key: "anthropicApiKey", value: "sk-ant-REALSECRET" }];
    const res = await POST(postReq({ anthropicApiKey: SECRET_SENTINEL }));
    expect(res.status).toBe(200);
    expect(h.rows.find((r) => r.key === "anthropicApiKey")?.value).toBe("sk-ant-REALSECRET");
  });

  it("updates a secret when a real new value is posted", async () => {
    h.rows = [{ key: "anthropicApiKey", value: "sk-old" }];
    await POST(postReq({ anthropicApiKey: "sk-new" }));
    expect(h.rows.find((r) => r.key === "anthropicApiKey")?.value).toBe("sk-new");
  });

  it("ignores the companion Configured flags", async () => {
    await POST(postReq({ anthropicApiKeyConfigured: true, theme: "light" }));
    expect(h.rows.find((r) => r.key === "anthropicApiKeyConfigured")).toBeUndefined();
    expect(h.rows.find((r) => r.key === "theme")?.value).toBe("light");
  });
});
