import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Measure the deterministic, high-value surface so the percentage is
      // meaningful. In vitest 4 `include` already reports every matching file
      // (untested ones included), so the threshold is a real ratchet against
      // new untested code — no `all` flag needed (it was removed in v4).
      include: ["src/lib/**", "src/stores/**"],
      exclude: [
        "node_modules/",
        "src/__tests__/",
        "**/*.d.ts",
        "**/*.config.*",
        ".next/",
        // I/O-only / non-deterministic modules: excluded so coverage reflects
        // testable logic, not external-service or filesystem glue.
        "src/lib/export/render.ts", // spawns the ffmpeg binary
        "src/lib/analysis/audio.ts", // ffmpeg transcode path
        "src/lib/analysis/azure.ts", // Azure Speech REST glue
        "src/lib/analysis/openai.ts", // OpenAI Whisper REST glue
        "src/lib/research/search/brave.ts", // NotImplemented scaffold
        "src/lib/research/search/tavily.ts", // NotImplemented scaffold
        "src/lib/research/generate-grounded.ts", // live LLM + search orchestration
        "src/lib/research/loop.ts", // live agentic loop
        "src/lib/research/subagent.ts", // live subagent fan-out
        "src/lib/agent/runner.ts", // live Anthropic streaming pipeline
        "src/lib/db/index.ts", // better-sqlite3 connection singleton
        "src/lib/db/migrations.ts", // DDL runner (covered via in-memory db tests)
        "src/lib/llm/proxy.ts", // SSE proxy to the FastAPI backend
      ],
      // Thresholds are set just below the measured baseline (see PR) so the gate
      // ratchets against regressions without being aspirational.
      // Measured baseline (scoped config): stmts 75.4 · branch 69.6 · funcs 69.0 · lines 76.8.
      thresholds: {
        lines: 74,
        functions: 66,
        branches: 67,
        statements: 72,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
