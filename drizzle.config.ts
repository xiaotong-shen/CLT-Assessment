import { defineConfig } from "drizzle-kit";
import { readFileSync } from "fs";

// Load .env.local for CLI usage (Next.js does this automatically at runtime,
// but drizzle-kit and tsx scripts run outside Next.js and need it manually).
try {
  readFileSync(".env.local", "utf8")
    .split("\n")
    .forEach((line) => {
      const eq = line.indexOf("=");
      if (eq === -1 || line.trimStart().startsWith("#")) return;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key && !(key in process.env)) process.env[key] = val;
    });
} catch {
  // .env.local absent (CI, production) — env vars must be set externally
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
