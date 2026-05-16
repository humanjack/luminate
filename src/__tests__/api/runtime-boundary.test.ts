import { describe, it, expect } from "vitest";
import { readdirSync, existsSync, statSync } from "fs";
import { join } from "path";

const apiDir = join(process.cwd(), "src", "app", "api");
const backendDir = join(process.cwd(), "backend");
const runtimeDoc = join(process.cwd(), "docs", "runtime-boundary.md");

function listRoutes(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir);
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const isDir = statSync(full).isDirectory();
    if (isDir) {
      out.push(...listRoutes(full, `${prefix}/${entry}`));
    } else if (entry === "route.ts" || entry === "route.tsx") {
      out.push(prefix || "/");
    }
  }
  return out;
}

describe("MVP runtime boundary (issue #7)", () => {
  it("documents the runtime decision in docs/runtime-boundary.md", () => {
    expect(existsSync(runtimeDoc)).toBe(true);
  });

  it("treats the backend directory as legacy/frozen", () => {
    // Backend directory still exists for reference, but its README must
    // call out the frozen status.
    expect(existsSync(backendDir)).toBe(true);
    const readme = join(backendDir, "README.md");
    expect(existsSync(readme)).toBe(true);
  });

  it("exposes the MVP API routes the frontend depends on", () => {
    const routes = listRoutes(apiDir);
    // The active runtime must own these route groups so the frontend
    // stays on one API surface.
    const required = [
      "/projects",
      "/projects/[id]",
      "/projects/[id]/research",
      "/projects/[id]/content",
      "/projects/[id]/slides",
      "/projects/[id]/scripts",
      "/projects/[id]/recordings",
      "/projects/[id]/video",
      "/llm/research",
      "/llm/content",
      "/llm/script",
      "/settings",
      "/init",
    ];
    for (const route of required) {
      expect(routes, `expected ${route} to be served by Next.js API`).toContain(route);
    }
  });
});
