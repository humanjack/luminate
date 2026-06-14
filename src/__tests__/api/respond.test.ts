import { describe, it, expect, vi } from "vitest";
import { ok, fail, serverError } from "@/lib/api/respond";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("respond helpers", () => {
  it("ok returns the data with the given init", async () => {
    const res = ok({ hello: "world" }, { status: 201 });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ hello: "world" });
  });

  it("fail produces a { error, code, requestId } envelope with the status", async () => {
    const res = fail("validation_error", "bad input", 400);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("bad input");
    expect(body.code).toBe("validation_error");
    expect(body.requestId).toMatch(UUID_RE);
  });

  it("fail merges extra fields", async () => {
    const res = fail("validation_error", "bad", 400, { fields: ["name"] });
    const body = await res.json();
    expect(body.fields).toEqual(["name"]);
  });

  it("serverError returns 500 with the message and logs the requestId", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = serverError(new Error("boom"), { message: "Failed to do thing" });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to do thing");
    expect(body.code).toBe("internal_error");
    expect(body.requestId).toMatch(UUID_RE);
    // logged with the same requestId so a user-facing id maps to a log line
    expect(spy).toHaveBeenCalledOnce();
    expect(String(spy.mock.calls[0][0])).toContain(body.requestId);
    spy.mockRestore();
  });

  it("each fail/serverError call gets a distinct requestId", async () => {
    const a = await fail("x", "a", 400).json();
    const b = await fail("x", "b", 400).json();
    expect(a.requestId).not.toBe(b.requestId);
  });
});
