import { z } from "zod";

/**
 * Validated, typed environment. Parsed once at module load (fail-fast on a bad
 * value). Server-only — it reads `process.env` and is imported only by API
 * routes and the LLM proxy.
 *
 * Note: provider API keys are deliberately NOT here. By design they live in the
 * SQLite Settings store and request bodies, not the environment.
 */
const schema = z.object({
  // Empty string is the documented "disable backend sync" value; anything else
  // must be a well-formed URL. Default keeps the local frontend+backend setup.
  BACKEND_URL: z.union([z.url(), z.literal("")]).default("http://localhost:8000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof schema>;

function parseEnv(): Env {
  const result = schema.safeParse({
    BACKEND_URL: process.env.BACKEND_URL,
    NODE_ENV: process.env.NODE_ENV,
  });
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration — ${issues}`);
  }
  return result.data;
}

export const env: Env = parseEnv();
