import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { serveMedia } from "@/lib/media/serve";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "luminate-media-"));
  vi.stubEnv("LUMINATE_DATA_DIR", root);
  await mkdir(path.join(root, "media/recordings/project"), { recursive: true });
  await writeFile(path.join(root, "media/recordings/project/audio.webm"), "0123456789");
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }); });
const request = (headers = {}, method = "GET") => new Request("http://localhost/recordings/project/audio.webm", { headers, method });

describe("persistent media serving", () => {
  it("serves newly saved media from the configured volume", async () => {
    const response = await serveMedia(request(), "recordings", ["project", "audio.webm"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/webm");
    expect(await response.text()).toBe("0123456789");
  });
  it("supports byte and suffix ranges for seeking", async () => {
    const response = await serveMedia(request({ Range: "bytes=2-5" }), "recordings", ["project", "audio.webm"]);
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(await response.text()).toBe("2345");
    expect(await (await serveMedia(request({ Range: "bytes=-3" }), "recordings", ["project", "audio.webm"])).text()).toBe("789");
  });
  it("rejects unsatisfiable ranges and supports HEAD without reading a body", async () => {
    expect((await serveMedia(request({ Range: "bytes=20-" }), "recordings", ["project", "audio.webm"])).status).toBe(416);
    const response = await serveMedia(request({}, "HEAD"), "recordings", ["project", "audio.webm"]);
    expect(response.headers.get("content-length")).toBe("10");
    expect(await response.text()).toBe("");
  });
  it("does not expose database files, traversal, or symlinks outside the media directory", async () => {
    await writeFile(path.join(root, "luminate.db"), "secret");
    await symlink(path.join(root, "luminate.db"), path.join(root, "media/recordings/project/leak.webm"));
    for (const parts of [["..", "..", "luminate.db"], ["project", "leak.webm"], ["project", "missing.webm"]]) {
      expect((await serveMedia(request(), "recordings", parts)).status).toBe(404);
    }
  });
});
