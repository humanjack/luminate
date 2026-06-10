const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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
    const backendResponse = await fetch(`${BACKEND_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

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
    console.error(`[${logPrefix}] Proxy error:`, error);
    return jsonError(`Failed to connect to backend: ${(error as Error).message}`, 502);
  }
}
