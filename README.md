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
- Every signup gets its own workspace; teammates join via invite links (optionally emailed).
- Roles: Admin, Manager, Member — enforced in the database, not just the UI.
- Onboarding, optional sample data, CSV import wizard (contacts, companies, deals) with column mapping and validation, full CSV export, JSON workspace backup.
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
| `npm run build` | Production build into `dist/` |
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
  lib/              csv, formatting, sanitizing, AI client, sample data, import/export logic
  integrations/     Supabase client + generated database types
  test/             unit tests
supabase/
  migrations/       schema, functions and RLS (source of truth)
  functions/        ai-chat, send-invite Edge Functions
```

---

## Go-live checklist

1. **Revoke the old Groq API key.** A previous version shipped one in client code; treat it as public.
   Create a new key and set it with `npx supabase secrets set GROQ_API_KEY=...`.
2. **Delete or reset the account created by the removed `seed_goom_construction.sql`** (it had a well-known password).
3. Back up the database, then apply the migrations: `npx supabase db push --linked`.
4. Deploy the Edge Functions (`ai-chat`, `send-invite`) and set their secrets.
5. Mirror the Auth settings from `supabase/README.md` in the hosted dashboard (email confirmation on,
   production Site URL and redirect URLs, password policy, MFA, leaked-password protection).
6. Fill in the legal/company placeholders on the marketing, Terms and Privacy pages
   (`src/components/marketing/site.ts`) and have Terms/Privacy reviewed.
7. Enable backups / point-in-time recovery for the production database.

## License

Proprietary and confidential. All rights reserved.
