import { NextRequest } from "next/server";

export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

/**
 * Proxy research requests to the FastAPI backend
 * The backend handles all LLM provider logic via LangChain
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { topic, depth } = body;

  if (!topic) {
    return new Response(JSON.stringify({ error: "Topic is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`[LLM Research] Proxying to backend: ${BACKEND_URL}/api/llm/research`);

  try {
    // Forward request to FastAPI backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/llm/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, depth }),
    });

    if (!backendResponse.ok) {
      const error = await backendResponse.text();
      console.error(`[LLM Research] Backend error:`, error);
      return new Response(
        JSON.stringify({ error: `Backend error: ${backendResponse.status}` }),
        { status: backendResponse.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Stream the response from backend to client
    const reader = backendResponse.body?.getReader();
    if (!reader) {
      return new Response(JSON.stringify({ error: "No response body from backend" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch (error) {
          console.error(`[LLM Research] Stream error:`, error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error(`[LLM Research] Proxy error:`, error);
    return new Response(
      JSON.stringify({ error: `Failed to connect to backend: ${(error as Error).message}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
