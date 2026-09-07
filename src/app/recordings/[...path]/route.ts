import { serveMedia } from "@/lib/media/serve";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return serveMedia(request, "recordings", (await params).path);
}
export const HEAD = GET;
