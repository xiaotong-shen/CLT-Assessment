# Deployment Guide

Step-by-step guide for deploying the CLT Assessment Platform on **Vercel** + **Supabase** (ca-central-1). Estimated time: 30–45 minutes for a first deploy.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| pnpm | 9+ | `npm i -g pnpm` |
| Vercel CLI | latest | `npm i -g vercel` |
| Git | any | — |

Accounts required:
- [Supabase](https://supabase.com) — Postgres database (free tier is fine for ≤500 students/year)
- [Vercel](https://vercel.com) — hosting (Hobby plan is free; Pro if you need >1 GB RAM functions)
- [Anthropic Console](https://console.anthropic.com) — API key for grading/translation
- [Resend](https://resend.com) — email (optional; only for magic-link staff auth)

---

## 1. Clone and install

```bash
git clone https://github.com/your-org/CLT-Assessment.git
cd CLT-Assessment
pnpm install
```

---

## 2. Supabase setup

### 2a. Create a project

1. Log into [app.supabase.com](https://app.supabase.com)
2. Click **New project**
3. Set **Region** to `ca-central-1` (Canada) for PIPEDA compliance
4. Choose a strong database password and save it somewhere safe

### 2b. Get the database URL

1. In your project dashboard: **Settings → Database → Connection pooling**
2. Select **Session mode** (not Transaction mode — Drizzle requires session mode)
3. Copy the **Connection string** — it looks like:
   ```
   postgresql://postgres.YOURREF:PASSWORD@aws-0-ca-central-1.pooler.supabase.com:5432/postgres
   ```

### 2c. Run migrations

With your `DATABASE_URL` set in `.env.local`:

```bash
cp .env.example .env.local
# Fill in DATABASE_URL in .env.local

pnpm db:migrate     # applies all Drizzle migrations in db/migrations/
pnpm db:seed        # seeds reading/grammar/writing item banks
pnpm seed:admin     # creates the first staff admin account
```

The seed scripts are idempotent — safe to run multiple times.

---

## 3. Environment variables

Copy `.env.example` → `.env.local` and fill in every value:

```bash
cp .env.example .env.local
```

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → Connection pooling (Session mode) |
| `AUTH_SECRET` | Run: `openssl rand -base64 32` |
| `AUTH_URL` | Your production URL, e.g. `https://assessment.yourschool.ca` |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys (optional) |

> **Cost note:** `ANTHROPIC_API_KEY` is the only variable that incurs per-use charges. See [ARCHITECTURE.md §7](ARCHITECTURE.md#7-cost-model) for a full cost breakdown (~$0.003/essay graded, ~$0.004/report translated).

---

## 4. Local development

```bash
pnpm dev
```

Open [http://localhost:3000/en](http://localhost:3000/en) (student) or [http://localhost:3000/en/login](http://localhost:3000/en/login) (staff).

Run tests before deploying:

```bash
pnpm tsc --noEmit    # type check
pnpm test            # 13 unit tests (Vitest)
pnpm test:e2e        # 4 E2E smoke tests (Playwright)
```

---

## 5. Deploy to Vercel

### 5a. Link the project

```bash
vercel link
# Follow prompts to create or link a Vercel project
```

### 5b. Add environment variables

Add each variable via the Vercel dashboard (**Project → Settings → Environment Variables**) or CLI:

```bash
vercel env add DATABASE_URL     production
vercel env add AUTH_SECRET      production
vercel env add AUTH_URL         production
vercel env add ANTHROPIC_API_KEY production
vercel env add RESEND_API_KEY   production
```

For the `vercel.json` references to work, the Vercel secret names must match exactly (e.g. `@database-url`, `@auth-secret` — see `vercel.json`).

### 5c. Deploy

```bash
vercel --prod
```

Or push to `main` — Vercel auto-deploys on push if the GitHub integration is connected.

### 5d. Verify

1. Visit `https://your-project.vercel.app/en` — welcome page should load
2. Visit `/en/intake` — assessment intake form
3. Visit `/en/login` — staff login
4. Try logging in with the admin account created in step 2c

---

## 6. Custom domain

In Vercel dashboard: **Project → Settings → Domains** → add your domain (e.g. `assessment.yourschool.ca`).

Then update `AUTH_URL` to the custom domain:

```bash
vercel env rm AUTH_URL production
vercel env add AUTH_URL production
# enter: https://assessment.yourschool.ca
vercel --prod  # redeploy to pick up new env
```

---

## 7. Database migrations (after initial deploy)

When schema changes are made:

```bash
# Generate a new migration file
pnpm db:generate

# Apply in production (requires DATABASE_URL to be set locally or via CI)
pnpm db:migrate
```

> ⚠️ Always run migrations before deploying application code that depends on the new schema.

---

## 8. CI/CD

The included `.github/workflows/ci.yml` runs on every push to `main`/`develop`:

1. **Unit tests** — TypeScript type check + Vitest (uses no DB)
2. **E2E tests** — Next.js build + Playwright smoke tests (uses placeholder env vars; no real DB)

To connect Vercel auto-deploys:
1. In Vercel dashboard: **Settings → Git** → connect to your GitHub repo
2. Set **Production Branch** to `main`
3. Vercel will deploy preview URLs for PRs and production for `main`

---

## 9. Monitoring & error tracking

### Vercel built-in
- **Functions log**: Vercel dashboard → Logs tab — real-time serverless function logs
- **Speed Insights**: Vercel dashboard → Speed Insights (enable in project settings)

### Recommended additions (Phase 2)
- **Sentry** — error tracking; add `@sentry/nextjs` and set `SENTRY_DSN`
- **Supabase Dashboard** — query performance, row counts, storage usage

No additional cost for Vercel logs (retained 1 day on Hobby, 7 days on Pro).

---

## 10. Supabase backups

Supabase **Pro plan** includes daily automated backups (point-in-time recovery). Free plan has no automated backups — schedule a manual pg_dump via a cron job or GitHub Actions if staying on free:

```bash
# Example: nightly backup to a local file
pg_dump "$DATABASE_URL" --no-acl --no-owner -F c -f backup-$(date +%Y%m%d).dump
```

For a school production deployment, **Pro plan** ($25/month) is strongly recommended.

---

## 11. Security checklist before go-live

- [ ] `AUTH_SECRET` is a random 32-byte value (not the example placeholder)
- [ ] `DATABASE_URL` uses the pooler URL, not the direct connection string
- [ ] Supabase Row-Level Security (RLS) is reviewed — current schema handles auth at the application layer via next-auth; RLS is optional but recommended for defence-in-depth
- [ ] Vercel environment variables are scoped to `production` only (not `preview` or `development`)
- [ ] Custom domain uses HTTPS (Vercel provisions TLS automatically)
- [ ] Admin password is changed after first login
- [ ] `.env.local` is in `.gitignore` (it is by default with Next.js)

---

## 12. Troubleshooting

### Build fails: `Cannot find module '@/...'`
Run `pnpm tsc --noEmit` locally — likely a missing import alias. Check `tsconfig.json` paths.

### `DATABASE_URL` connection timeout
- Confirm you are using the **Session mode** pooler URL (port 5432), not the direct URL (port 5432 direct, no pooler) or Transaction mode (port 6543).
- Supabase free projects pause after 7 days of inactivity — resume from the Supabase dashboard.

### `AUTH_SECRET` mismatch / sessions not persisting
- Ensure `AUTH_SECRET` is identical across all environment variable scopes.
- Clear browser cookies and retry.

### Essay grading returns 500
- Verify `ANTHROPIC_API_KEY` is set in Vercel env and is valid.
- Check Vercel function logs for the specific error from the Anthropic SDK.
- The grader has a fallback: if grading fails, the essay is marked `isCorrect = true` so the assessment continues.

### E2E tests fail in CI
- The E2E job uses `DATABASE_URL: postgresql://placeholder:placeholder@localhost:5432/placeholder` — tests must not require a real DB.
- If a new page makes a DB call at build time (e.g. via `generateStaticParams`), add a guard for the placeholder URL.

---

## Architecture reference

See [ARCHITECTURE.md](ARCHITECTURE.md) for:
- Full technology stack and rationale
- Database schema
- MSAT engine algorithm
- AI/LLM pipeline details and cost model
- Environment variable reference (§11)
- Planned audio pipeline (§12)
