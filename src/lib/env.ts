import { z } from "zod";

/**
 * Environment schema.
 *
 * Only DATABASE_URL and AUTH_SECRET are required at startup — without them
 * the app cannot boot at all. Everything else is optional and degrades
 * gracefully:
 *
 *   - AUTH_URL              → next-auth derives from request origin if absent
 *   - RESEND_API_KEY        → magic-link sign-in disabled (Credentials still works)
 *   - ANTHROPIC_API_KEY     → essay grading + translation disabled (engine
 *                             still completes; essays scored as "submitted")
 *   - SUPABASE_URL/_KEY     → audio pipeline (Phase 2) disabled
 *   - OPENAI_API_KEY        → TTS generation script (Phase 2) disabled
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required — see .env.example"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required — generate with: openssl rand -base64 32"),

  AUTH_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

// Throws at startup if any *required* var is missing.
// Do NOT call this in client components — import from server-only modules only.
export const env = envSchema.parse(process.env);
