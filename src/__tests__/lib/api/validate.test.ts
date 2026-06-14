import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson, parseJson } from "@/lib/api/validate";
import { POST as contentPOST } from "@/app/api/llm/content/route";

function req(body: string) {
  return new NextRequest("http://test.local/x", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
  });
}

describe("readJson", () => {
  it("returns the parsed body for valid JSON", async () => {
    const r = await readJson(req(JSON.stringify({ a: 1 })));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ a: 1 });
  });

  it("returns a 400 invalid_json envelope for a malformed body", async () => {
    const r = await readJson(req("{ not valid"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
      expect((await r.response.json()).code).toBe("invalid_json");
    }
  });
});

describe("parseJson", () => {
  const schema = z.object({
    topic: z.string().min(1),
    depth: z.enum(["quick", "detailed"]).default("detailed"),
  });

  it("returns validated data and applies defaults", async () => {
    const r = await parseJson(req(JSON.stringify({ topic: "AI" })), schema);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ topic: "AI", depth: "detailed" });
  });

  it("returns a 400 validation_error with field issues on a bad body", async () => {
    const r = await parseJson(req(JSON.stringify({ topic: "", depth: "deep" })), schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
      const body = await r.response.json();
      expect(body.code).toBe("validation_error");
      expect(Array.isArray(body.fields)).toBe(true);
      expect(body.fields.length).toBeGreaterThan(0);
    }
  });

  it("returns invalid_json (not a 500) for malformed input", async () => {
    const r = await parseJson(req("nope"), schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect((await r.response.json()).code).toBe("invalid_json");
  });
});

describe("route hardening: malformed body no longer 500s", () => {
  it("POST /api/llm/content returns 400 invalid_json for a malformed body", async () => {
    const r = await contentPOST(req("{ broken"));
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe("invalid_json");
  });
});
