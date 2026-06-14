import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({ shouldThrow: false }));

vi.mock("@/lib/db", () => ({
  db: {
    run: () => {
      if (h.shouldThrow) throw new Error("db locked");
      return undefined;
    },
  },
}));
vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray) => ({ query: strings.join("") }),
}));

import { GET } from "@/app/api/ready/route";

beforeEach(() => {
  h.shouldThrow = false;
  // Silence the logger's stderr line on the failure path.
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

describe("GET /api/ready", () => {
  it("returns 200 with db:ok when the connection answers", async () => {
    h.shouldThrow = false;
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks.db).toBe("ok");
  });

  it("returns 503 with db:down when the connection throws", async () => {
    h.shouldThrow = true;
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.checks.db).toBe("down");
  });
});
