# Goom — CRM for teams that close

Goom is a fast, focused CRM for small sales teams: a visual pipeline, contacts and companies,
activities and tasks, forecasting and reports, in team workspaces with roles and invitations.

Built with React, TypeScript and Vite on Supabase (Postgres, Auth, Row Level Security, Edge Functions).

---

## Features

**Pipeline & deals**
- Kanban board with drag-and-drop (plus a keyboard/touch "Move to…" menu), optimistic updates with undo, column counts and totals, and a sortable list view.
- Multiple pipelines with configurable stages (color, default probability, won/lost flags).
- Deal detail with inline editing, activity timeline, tasks, notes (markdown) and a full change history.
- Won/lost tracking with lost reasons.

**Contacts & companies**
- Server-side search, sorting, filters and pagination.
- Detail views with related deals, activities and tasks; duplicate detection on create.
- Bulk actions: tag, untag, export, delete.

**Work management**
- Tasks grouped by Overdue / Today / Upcoming, with assignees, priorities and quick-add ("tomorrow", "!high").
- Activity log (calls, emails, meetings, notes) with email templates.
- Calendar (month and agenda) of tasks, closing deals and activities.

**Insights**
- Dashboard with real KPIs: open and weighted pipeline, won this month vs. last month, win rate, closing soon, my tasks.
- Forecast by close month (commit / best case / pipeline) against the workspace's monthly quota.
- Reports by period: won revenue, win rate, deal size, sales cycle, stage distribution, lost reasons, leaderboard, activity volume, CSV export.

**Workspace & team**
- Every signup gets its own workspace with a 14-day free trial; teammates join via invite links (optionally emailed).
- Members of several workspaces switch between them from the sidebar; members can leave a workspace.
- Roles: Admin, Manager, Member — enforced in the database, not just the UI.
- Onboarding, Excel/CSV import wizard (contacts, companies, deals) with column mapping and validation, full CSV/Excel export, JSON workspace backup.

**Plans & billing**
- Starter, Growth and Enterprise plans with limits enforced in the database.
- 14-day trial, then a paid period. When it ends, the workspace's data is locked (not deleted) behind a paywall where admins request a plan; the platform owner activates it after payment from the Platform console.
- ⌘K command palette, keyboard shortcuts (press `?`), notifications, light and dark themes.

**AI assistant** — answers questions about your pipeline and drafts follow-ups, grounded in a
summary of your workspace data. Runs through an authenticated, rate-limited Edge Function; the AI
provider key never reaches the browser.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Router |
| UI | Tailwind CSS, Radix UI / shadcn primitives, Lucide icons, Recharts |
| Data | TanStack Query v5, Supabase JS |
| Backend | Supabase: Postgres + RLS, Auth, Storage, Realtime, Edge Functions (Deno) |
| AI | Groq (via the `ai-chat` Edge Function) |
| Tests | Vitest, Testing Library |

---

## Getting started (local development)

Prerequisites: Node.js 18+, npm 9+, and a Supabase project (hosted, or local via `npx supabase start`).

```bash
npm install
cp .env.example .env      # then fill in your Supabase URL and publishable (anon) key
npm run dev               # http://localhost:8080
```

`.env` holds only public client configuration:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
```

Secrets (the Groq API key, email provider key) are **Edge Function secrets**, never `VITE_*`
variables — anything prefixed `VITE_` is bundled into the public JavaScript.

Database setup, Edge Functions, secrets and Auth settings are documented in
[supabase/README.md](supabase/README.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on port 8080 |
| `npm run build` | Typecheck, then production build into `dist/` (fails if the Supabase env vars are missing or a `VITE_*` value looks like a secret) |
| `npm run typecheck` | TypeScript check only |
| `npm run check` | Typecheck + lint + tests (what CI runs, plus the build) |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the unit tests (Vitest) |
| `npm run lint` | Run ESLint |

## Project structure

```
src/
  pages/            route views (lazy-loaded)
  components/
    common/         shared states (empty/error/loading), confirm dialog, error boundary
    ui/             design-system primitives (shadcn/Radix)
    pipeline/ contacts/ companies/ activities/ tasks/ dashboard/ settings/ onboarding/ marketing/
  contexts/         AuthContext: session, current workspace, role
  hooks/            data hooks (TanStack Query) per domain
  lib/              csv, formatting, sanitizing, AI client, import/export logic
  integrations/     Supabase client + generated database types
  test/             unit tests
supabase/
  migrations/       schema, functions and RLS (source of truth)
  functions/        ai-chat, send-invite Edge Functions
```

---

## Deployment (Vercel)

`vercel.json` configures the SPA fallback (deep links such as `/invite/<token>` and
`/auth?mode=reset` must serve `index.html`), security headers (CSP, frame denial, HSTS) and caching
(hashed assets cached for a year, `index.html` never cached, so a deploy is picked up immediately).
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Vercel project's environment
variables (and `VITE_TURNSTILE_SITE_KEY` for CAPTCHA, see below). If you load assets from another
origin later, extend the `Content-Security-Policy`; it already allows Cloudflare Turnstile.

CI (`.github/workflows/ci.yml`) runs the typecheck, lint, tests and production build, and checks
the edge functions with Deno, on every push and pull request.

## Go-live checklist

1. **Rotate the credentials in the git history** (see the notice at the top of
   [supabase/README.md](supabase/README.md)): the Supabase `service_role` key and the Groq API key
   were committed and pushed. Disable the legacy Supabase keys or rotate the JWT secret, and revoke
   the Groq key.
2. Back up the database, then apply the migrations.
   - **The production migration history is incomplete:** it records `20260926000001` to
     `20260927000001` but none of the six `20260919*` base migrations. The later migrations depend on
     those tables, so they were most likely applied by hand. Do **not** use `db push --include-all`: it would re-run the
     base migrations and put back the pre-multi-tenant versions of functions that later migrations
     replaced. After confirming the base tables exist (Table Editor), mark them as applied:
     `npx supabase migration repair --status applied 20260919000001 20260919000002 20260919000003 20260919000004 20260919000005 20260919000006 --linked`
   - Check that only `20261007000001` is pending with `npx supabase db push --linked --dry-run`, then
     run `npx supabase db push --linked`.
   - `20261007000001` starts a 14-day trial for every existing workspace at the moment it runs.
3. Add yourself as a platform admin (SQL in supabase/README.md). Activate paying or complimentary
   workspaces in **Platform** before their trials end.
4. After the migration, deploy the Edge Functions: `npx supabase functions deploy ai-chat send-invite`
   (`send-invite` has never been deployed, so invitation emails aren't sent today). Set their secrets:
   a new `GROQ_API_KEY`, `RESEND_API_KEY`, `INVITE_FROM_EMAIL` (verified domain), `SITE_URL`,
   `ALLOWED_ORIGINS` (the production origin, e.g. `https://app.example.com`).
5. Mirror the Auth settings from supabase/README.md in the hosted dashboard:
   - email confirmation on;
   - production Site URL and redirect URLs;
   - secure email and password change;
   - leaked-password protection;
   - CAPTCHA, in this order: create a Cloudflare Turnstile widget for your domain; set
     `VITE_TURNSTILE_SITE_KEY` in Vercel and deploy; only then enable CAPTCHA (provider Turnstile,
     the widget's secret key) under Authentication → Attack Protection. Enabled without a deployed
     site key, every password sign-in is refused;
   - custom SMTP;
   - MFA.
6. Check that the shared legacy workspace was split (query in supabase/README.md).
7. Decide how customers pay (invoice / bank transfer today; a gateway can call
   `billing_activate_workspace`). Make sure the sales mailbox in `src/components/marketing/site.ts`
   is monitored, since plan requests and the contact form point there.
8. Fill in the legal/company placeholders in `src/components/marketing/site.ts`, and have Terms and
   Privacy reviewed. Privacy must name the sub-processors (Supabase, Groq, Resend, Vercel).
9. Set the Vercel env vars, deploy, then click through sign-up → confirm email → onboarding → invite
   a teammate → import a spreadsheet → AI assistant on the production URL.
10. Enable backups and point-in-time recovery for the production database.

## License

Proprietary and confidential. All rights reserved.
