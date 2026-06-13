import { defineConfig } from "vitest/config";
import path from "path";

// Separate config for the research eval harness (Phase 5, #49). Kept out of the
// default `vitest.config.ts` include so `npm run test:run` never triggers real
// API calls. Run with `make eval-research` (needs ANTHROPIC_API_KEY).
export default defineConfig({
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    testTimeout: 20 * 60 * 1000,
    hookTimeout: 60 * 1000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
