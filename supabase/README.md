# Supabase backend

> **Security action required: revoke the old Groq key.**
> An earlier version of this repository shipped a Groq API key in client code (`src/lib/groq.ts`).
> Anything that was ever committed or bundled into the browser must be treated as public.
> **Revoke that key in the Groq console (https://console.groq.com/keys) now**, create a new one, and
> store it only as an Edge Function secret (see below). Also rotate/delete any account created by
> the removed `seed_goom_construction.sql` script, which set a well-known password.

This folder holds the database schema (migrations), the local-dev seed, the edge functions and the
local stack config.

```
supabase/
  config.toml              local stack config (auth policy, functions)
  migrations/              ordered schema migrations (the only source of truth)
  seed.sql                 LOCAL DEVELOPMENT ONLY sample users + data
  functions/
    _shared/               CORS + auth helpers
    ai-chat/               authenticated, rate-limited proxy to Groq
    send-invite/           optional invitation emails via Resend
```

## Data model in one paragraph

Every signup gets its own **workspace** (`organizations`). Membership and the role
(`admin` / `manager` / `rep`) live in `organization_members`; teammates join through
`invitations` (7-day links). Every business table has `organization_id`, which defaults to
`public.current_org_id()` — clients never send it — and Row Level Security limits every read and
write to the caller's current workspace. `user_roles` is legacy and no longer consulted.
All privileged operations go through `SECURITY DEFINER` RPCs that check membership and role
explicitly; `anon` can execute only `get_invitation_preview`.

Since `20260927000001` every workspace also has a **plan** (`starter` / `growth` / `enterprise`,
limits enforced in the database) and a **status** (`active` / `suspended`), reps only see their own
pipeline work (see *Roles* below), and the SaaS operator has a read-only **platform console**.

## Plans and limits

`public.plan_limits(plan)` is the database copy of `src/lib/plans.ts` (keep them in sync; `null` =
unlimited):

| | Starter | Growth | Enterprise |
|---|---|---|---|
| Seats (members + pending invitations) | 3 | 15 | unlimited |
| Pipelines | 1 | 5 | unlimited |
| Contacts | 1,000 | 25,000 | unlimited |
| AI requests / month (whole workspace) | 50 | 500 | 2,000 |
| Deal audit history (`deal_audit_log`) | – | – | yes |

Enforcement (errors are `P0001` with a message the UI shows as is, e.g. *"Your Starter plan
includes 1,000 contacts. Upgrade to add more."*):

- seats: `create_invitation` (members + pending invitations) and invitation acceptance;
- pipelines: `BEFORE INSERT` trigger on `pipelines`;
- contacts: statement-level `AFTER INSERT` trigger on `contacts` (a CSV import that would cross the
  limit is rejected as a whole, without recounting per row);
- AI: `consume_ai_quota` (service role, called by the `ai-chat` function) counts the workspace's
  successful requests since the 1st of the month (UTC) on top of the per-user 20/min and 300/day
  guards. Requests whose AI call failed are marked `ai_usage.failed` and don't count toward the plan.
  `ai-chat` answers `429` with `code: "plan_limit"` (monthly allowance used up) or
  `code: "rate_limit"` (per-user guard);
- audit history: `deal_audit_log` is readable only on Enterprise (RLS).

Forecast, advanced reports, CSV import/export and backups are gated in the UI only.
New workspaces start on Starter. RPCs: `get_workspace_usage()` (any member) and
`set_workspace_plan(p_plan)` (admins; a downgrade is refused while usage exceeds the target plan,
naming the limit). There is no payment integration yet: admins switch plans themselves.

## Roles (RBAC)

| | admin | manager | rep |
|---|---|---|---|
| Deals | all | all | owned or created by them |
| Tasks | all | all | created by or assigned to them |
| Activities | all | all | their own + those on deals they can see |
| Deal audit log (Enterprise) | all | all | deals they can see |
| Contacts & companies | shared | shared | shared (delete: creator only) |
| Assign a deal to someone else | yes | yes | no (owner must stay empty or themselves) |
| Invite | any role | reps only | – |
| Roles, members, workspace settings, plan | yes | – | – |

RLS implements the visibility (`(select public.current_org_role())` / `(select auth.uid())` are
evaluated once per statement), the `trg_01_deal_owner_guard` trigger blocks reps from reassigning
deals, and `get_dashboard_analytics` / `global_search` apply the same filters.

## Platform console (SaaS operator)

Platform admins see platform-wide counts and metadata through the `platform_*` RPCs
(`platform_overview`, `platform_timeseries`, `platform_workspaces`, `platform_users`,
`platform_feedback`, `platform_contact_requests`, `platform_set_workspace_plan`,
`platform_set_workspace_status`). They get **no** extra row access: they can't read any
workspace's deals, contacts, companies, activities or tasks. The table has no client policies;
add yourself in the SQL editor:

```sql
insert into public.platform_admins (user_id)
select id from auth.users where lower(email) = lower('you@yourdomain.com');
```

Suspending a workspace (`platform_set_workspace_status(id, 'suspended')`) hides all of its data
from its members immediately (`current_org_id()` never returns a suspended workspace); their
`get_my_context()` then fails with *"This workspace has been suspended. Contact support."* unless
they also belong to another active workspace, which becomes their current one.

## Applying migrations to the hosted project

Prerequisites: the Supabase CLI (`npx supabase ...`) and the project ref.

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>

# Take a backup first (Dashboard -> Database -> Backups, or:)
npx supabase db dump --linked -f backup-$(date +%F).sql
npx supabase db dump --linked --data-only -f backup-data-$(date +%F).sql

# See what will run, then apply
npx supabase migration list --linked
npx supabase db push --linked
```

Notes for existing projects:

- `20260926000001..3` are written to run on top of `20260919000001..06` **on a database that already
  has data**, including one where the old loose scripts (`fixes.sql`, `make_admin*.sql`, ...) were
  run by hand. All existing policies in `public` are dropped and recreated, whatever their names.
- All existing users and records are moved into **one** workspace (named after the earliest admin's
  company). Every user keeps their old role from `user_roles`; if nobody was an admin, the earliest
  user becomes one. Duplicate empty "Sales Pipeline" rows created per user by the old signup trigger
  are removed.
- If the 20260919 migrations were never recorded in `supabase_migrations.schema_migrations` because
  the schema was created by pasting SQL, mark them as applied first so they are not re-run:
  `npx supabase migration repair --status applied 20260919000001 20260919000002 20260919000003 20260919000004 20260919000005 20260919000006`
  (they are idempotent, so re-running them is also safe).
- `20260927000001` (plans, RBAC, platform console) is also available as one paste-able,
  all-or-nothing script, `goom_upgrade_2026-09-27.sql` (handed over with this upgrade), for projects that are upgraded from the SQL
  editor instead of `supabase db push` (it records itself in `supabase_migrations.schema_migrations`).
- After pushing, regenerate the client types and compare with the committed file:
  `npx supabase gen types typescript --linked > src/integrations/supabase/types.ts`

## Edge functions

```bash
npx supabase functions deploy ai-chat
npx supabase functions deploy send-invite
```

Both functions verify the caller's JWT themselves (`supabase.auth.getUser`), so `verify_jwt` is
off in `config.toml`; keep it off if you deploy from the dashboard as well.

### Secrets

Secrets live on the server only. **Never** put them in `VITE_*` variables — those are bundled into
the public JavaScript.

```bash
# AI assistant (required for the assistant; without it ai-chat returns 503 and the UI says so)
npx supabase secrets set GROQ_API_KEY=gsk_...
npx supabase secrets set GROQ_MODEL=llama-3.3-70b-versatile          # optional (default)
npx supabase secrets set GROQ_FALLBACK_MODEL=llama-3.1-8b-instant    # optional (default)
npx supabase secrets set AI_RATE_LIMIT_PER_MINUTE=20 AI_RATE_LIMIT_PER_DAY=300   # optional (defaults)

# Invitation emails (optional; without them the UI shows a copyable invite link only)
npx supabase secrets set RESEND_API_KEY=re_... INVITE_FROM_EMAIL="Your CRM <invites@yourdomain.com>"
npx supabase secrets set SITE_URL=https://app.yourdomain.com

# Optional: restrict which browser origins may call the functions
npx supabase secrets set ALLOWED_ORIGINS=https://app.yourdomain.com

npx supabase secrets list
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.
The `INVITE_FROM_EMAIL` domain must be verified in Resend.

AI rate limiting is enforced in the database (`public.consume_ai_quota`, service role only) using
the `ai_usage` table: 20 requests per minute and 300 per day per user by default, plus the
workspace's monthly plan allowance (see *Plans and limits*). `ai_usage` keeps about 13 months of
history. Redeploy `ai-chat` after applying `20260927000001` so the plan limit gets its own message.

## Hosted Auth settings to mirror

`config.toml` only configures the local stack. Set the same on the hosted project in the dashboard:

| Where (Dashboard -> Authentication) | Setting |
|---|---|
| URL Configuration -> Site URL | `https://app.yourdomain.com` (your production URL, not localhost) |
| URL Configuration -> Redirect URLs | `https://app.yourdomain.com/**` (plus preview URLs you actually use) |
| Sign In / Providers -> Email | **Confirm email: ON** (invitations are matched on confirmed email addresses) |
| Sign In / Providers -> Email | Secure password change: ON; Secure email change: ON |
| Passwords / Policies | Minimum length **8**; required characters: **letters and digits** |
| Passwords / Policies | **Leaked password protection: ON** (HaveIBeenPwned check, Pro plan) |
| Multi-Factor | TOTP (authenticator app): **enabled** |
| Rate Limits | Keep the defaults or stricter; configure custom SMTP so auth emails are not throttled |
| Attack Protection | Consider enabling CAPTCHA (Turnstile/hCaptcha) for sign-up and password reset |
| Sessions | Optional: inactivity timeout / time-box for sensitive deployments |
| Emails -> SMTP | Configure a real SMTP provider (the built-in one is for testing only) |

Also check **Database -> Extensions** has `pgcrypto` and `pg_trgm` enabled and **API -> Exposed
schemas** is just `public` (and `graphql_public` if used).

## Backups and recovery

- Enable **Point-in-Time Recovery** (Dashboard -> Database -> Backups; Pro plan add-on) for any
  production workspace data. Daily backups alone can lose up to a day of CRM activity.
- Take a manual `supabase db dump` before every migration push (see above) and keep it off-site.
- Periodically test a restore into a fresh project.

## One-off repair: splitting the shared legacy workspace

`20260926000001` put every pre-upgrade account into ONE shared workspace together with the old
"Goom Construction" demo records. `split_legacy_workspace.sql` (handed over with this upgrade;
deliberately not in `migrations/` because it is a one-off data repair) undoes that: the workspace stays with its original owner, every other backfilled
member gets a private workspace with the records they created, and the seeded demo records are
deleted everywhere (exact names/titles/emails from the old seed files). Run it **after**
`20260927000001`:

1. Take a backup.
2. Paste the file into the SQL editor, select the **PREVIEW** block (between `/*` and `*/`) and run
   it: it lists every member of the shared workspace with what will happen to them and how many
   records they'll get, plus how many demo records will be deleted.
3. Run the whole file. It's a single transaction (any error rolls everything back) and re-running
   it is a no-op. The shared and new workspaces are put on the Growth plan so nobody loses what
   they had.
4. Optionally delete the old seed account `marakicreative@gmail.com` (statement at the end of the
   file, commented out) — it was created with a publicly known password.

## Local development

```bash
npx supabase start          # local stack; prints the local URL and publishable key for .env.local
npx supabase db reset       # applies all migrations, then seed.sql
npx supabase functions serve --env-file supabase/functions/.env
```

`seed.sql` creates `admin@example.com` and `rep@example.com` (password `local-dev-password1`) in a
fictional "Sample Workspace". It refuses to run if the database contains any non-`example.com`
user, but **never run it against a hosted database**. Email confirmations are on locally too:
confirmation and invite emails appear in Inbucket at http://localhost:54324.

## Security model checklist (for reviewers)

- RLS is enabled on every table in `public`; policies are workspace-scoped via
  `(select public.current_org_id())`, which only returns a workspace the caller belongs to.
- Deletes of shared records: creator/owner, or workspace admin/manager. Pipelines/stages: admins and
  managers only. Notifications and the deal audit log are written only by triggers.
- Reps see only their own deals/tasks/activities (RLS + the same filters in SECURITY DEFINER RPCs)
  and can't assign deals to others; plan limits are enforced by triggers/RPCs, not the UI.
- `platform_admins` has RLS with no policies and no client grants; platform RPCs return counts and
  metadata only and platform admins have no extra RLS access.
- `profiles.current_organization_id` can only point at a workspace the user is a member of (trigger).
- Cross-workspace references (a deal pointing at another workspace's stage/contact, a task assigned
  to a non-member, ...) are rejected by `enforce_same_org_references`.
- Function `EXECUTE` is revoked from `PUBLIC`/`anon`/`authenticated` and granted back explicitly;
  default privileges stop future functions from being public.
- `anon` has no table privileges except `INSERT` on `contact_requests` (length-checked).
- The last admin of a workspace cannot be demoted, removed, or delete their account while other
  members remain.
- Deleting an account removes workspaces where the user was the only member; in shared workspaces
  the user's records remain with `created_by` / `owner_id` set to NULL. (Avatar files in the
  `avatars` storage bucket are not removed by `delete_my_account`.)
