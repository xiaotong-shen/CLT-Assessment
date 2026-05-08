/**
 * Loads .env.local into process.env for CLI scripts run outside Next.js.
 * Next.js does this automatically at runtime; drizzle-kit and tsx scripts need it manually.
 * Import this as the very first line of any CLI script.
 */
import { readFileSync } from "fs";

try {
  readFileSync(".env.local", "utf8")
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eq = trimmed.indexOf("=");
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      // Strip surrounding quotes (single or double)
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    });
} catch {
  // .env.local absent in CI/production — env vars come from the platform
}
