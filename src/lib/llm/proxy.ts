import { fail } from "@/lib/api/respond";
import { env } from "@/lib/env";
import { fetchWithTimeout } from "@/lib/net/withTimeout";

const BACKEND_URL = env.BACKEND_URL;
const CONNECT_TIMEOUT_MS = 8000;

export function jsonError(
  message: string,
  status: number,
  code = "backend_proxy_error"
): Response {
  // Share the standard { error, code, requestId } envelope so the streaming
  // proxy's error responses match the rest of the API surface.
  return fail(code, message, status);
}

// Forwards an LLM generation request to the FastAPI backend and streams the
// SSE response back to the client unchanged.
export async function proxyLLMStream(
  path: string,
  payload: Record<string, unknown>,
  logPrefix: string
): Promise<Response> {
  console.log(`[${logPrefix}] Proxying to backend: ${BACKEND_URL}${path}`);

  try {
    // Bounded connect timeout: a dead/slow backend used to hang until the
    // platform default. NOT retried — replaying a half-consumed SSE stream is
    // incorrect.
    const backendResponse = await fetchWithTimeout(
      `${BACKEND_URL}${path}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      CONNECT_TIMEOUT_MS
    );

    if (!backendResponse.ok) {
      const error = await backendResponse.text();
      console.error(`[${logPrefix}] Backend error:`, error);
      return jsonError(`Backend error: ${backendResponse.status}`, backendResponse.status);
    }

    if (!backendResponse.body) {
      return jsonError("No response body from backend", 500);
    }

    return new Response(backendResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const err = error as Error;
    console.error(`[${logPrefix}] Proxy error:`, err);
    // Make the failure mode legible: content/script generation requires the
    // (currently frozen) FastAPI backend — see docs/runtime-boundary.md / #60.
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      return jsonError(
        `The content/script backend at ${BACKEND_URL} did not respond within ${CONNECT_TIMEOUT_MS / 1000}s. Is it running? (see docs/runtime-boundary.md)`,
        504,
        "BACKEND_UNAVAILABLE"
      );
    }
    return jsonError(
      `Could not reach the content/script backend at ${BACKEND_URL}. Start it (\`make backend-dev\`) or set BACKEND_URL. (see docs/runtime-boundary.md)`,
      502,
      "BACKEND_UNAVAILABLE"
    );
  }
}
