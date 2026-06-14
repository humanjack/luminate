import { NextResponse } from "next/server";

/**
 * Standard API response helpers.
 *
 * Error responses across the route handlers were ad-hoc `{ error: string }`
 * shapes with no machine-readable `code` and no `requestId` to correlate a
 * user-facing failure with a server log line. These helpers produce a
 * consistent envelope `{ error, code, requestId }` that is a *superset* of the
 * old shape, so existing clients/tests that read `.error` keep working.
 */

export interface ErrorEnvelope {
  error: string;
  code: string;
  requestId: string;
  [key: string]: unknown;
}

/** Success response (thin wrapper over NextResponse.json). */
export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

/**
 * Client/known error with a stable `code` (e.g. "validation_error",
 * "not_found") and an explicit status.
 */
export function fail(
  code: string,
  message: string,
  status: number,
  extra?: Record<string, unknown>
): NextResponse {
  const requestId = crypto.randomUUID();
  return NextResponse.json(
    { error: message, code, requestId, ...(extra ?? {}) },
    { status }
  );
}

/**
 * Unexpected server error. Logs the cause with the same `requestId` returned to
 * the client so a reported id maps to a log line. The `message` preserves each
 * route's existing user-facing string.
 */
export function serverError(
  error: unknown,
  opts?: { message?: string; code?: string }
): NextResponse {
  const requestId = crypto.randomUUID();
  const message = opts?.message ?? "Internal server error";
  const code = opts?.code ?? "internal_error";
  console.error(`[${requestId}] ${message}:`, error);
  return NextResponse.json({ error: message, code, requestId }, { status: 500 });
}
