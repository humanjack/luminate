import { NextRequest } from "next/server";
import { runAgent } from "@/lib/agent/runner";
import type { AgentStepName } from "@/lib/agent/types";

export const runtime = "nodejs";
// Agent runs can take minutes; bump per-route timeout.
export const maxDuration = 300;

interface RunBody {
  projectId: string;
  apiKey: string;
  model: string;
  topic?: string;
  depth?: "quick" | "detailed" | "comprehensive";
  format?: "presentation" | "tutorial" | "explainer";
  targetLength?: number;
  fromStep?: AgentStepName;
  toStep?: AgentStepName;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RunBody;

  if (!body.projectId || !body.apiKey || !body.model) {
    return new Response(
      JSON.stringify({ error: "projectId, apiKey and model are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const controller = new AbortController();
  request.signal.addEventListener("abort", () => controller.abort());

  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (event: unknown) => {
        const payload = `data: ${JSON.stringify(event)}\n\n`;
        ctrl.enqueue(encoder.encode(payload));
      };

      try {
        for await (const event of runAgent(body, controller.signal)) {
          send(event);
        }
        ctrl.enqueue(encoder.encode(`data: [DONE]\n\n`));
        ctrl.close();
      } catch (err) {
        send({ type: "run_error", error: (err as Error).message });
        ctrl.close();
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
