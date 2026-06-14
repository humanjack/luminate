import { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { fail } from "./respond";

/**
 * Request-body parsing/validation helpers.
 *
 * Many routes call `await request.json()` directly — a malformed or empty body
 * throws a SyntaxError that escapes as an opaque 500. `readJson` turns that into
 * a clean 400, and `parseJson` adds zod schema validation with flattened field
 * issues. Both return a discriminated result so the route returns the error
 * response (before any streaming starts) on failure:
 *
 *   const parsed = await parseJson(request, schema);
 *   if (!parsed.ok) return parsed.response;
 *   const { ...fields } = parsed.data;
 */
export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export async function readJson(request: NextRequest): Promise<ParseResult<unknown>> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return { ok: false, response: fail("invalid_json", "Invalid JSON body", 400) };
  }
}

export async function parseJson<T>(
  request: NextRequest,
  schema: ZodType<T>
): Promise<ParseResult<T>> {
  const read = await readJson(request);
  if (!read.ok) return read;

  const result = schema.safeParse(read.data);
  if (!result.success) {
    const fields = result.error.issues.map((i) => ({
      path: i.path.join(".") || "(root)",
      message: i.message,
    }));
    return {
      ok: false,
      response: fail("validation_error", "Request validation failed", 400, { fields }),
    };
  }
  return { ok: true, data: result.data };
}
