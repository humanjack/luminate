import path from "path";
import { defineConfig } from "drizzle-kit";

// Mirror src/lib/paths.ts dbFilePath() so db:migrate targets the same file the
// app uses. (Inlined: drizzle-kit runs this config standalone.)
const dbUrl = process.env.LUMINATE_DATA_DIR
  ? path.join(process.env.LUMINATE_DATA_DIR, "luminate.db")
  : "./luminate.db";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: dbUrl,
  },
});
