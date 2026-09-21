# Goom — CRM for Teams That Close

<p align="center">
  <strong>The fast, visual CRM built for modern sales teams to track deals, engage contacts, and forecast revenue with precision.</strong>
</p>

---

## Overview

**Goom** is a high-velocity CRM and pipeline management platform designed specifically for sales reps and revenue leaders. Built on top of a modern React and Supabase architecture, Goom combines lightning-fast performance with a sleek, distraction-free interface that replaces bloated legacy enterprise tools.

Every workflow in Goom is optimized for speed—from moving deals across customizable Kanban stages and logging customer interactions in seconds, to automated revenue forecasting and AI-assisted deal insights powered by Groq.

---

## Key Features

### 1. Visual Pipeline & Deal Management
- **Interactive Kanban Board**: Smooth drag-and-drop deal tracking across customizable pipeline stages (Lead, Qualification, Proposal, Negotiation, Closed Won, Closed Lost).
- **Deal Detail & Audit Trail**: Real-time audit history of every stage transition, deal value adjustment, and owner assignment.
- **Weighted Value Calculations**: Track both total pipeline value and probability-weighted expected revenue in real-time.

### 2. Contact & Company Intelligence
- **360° Account Views**: Complete company directory with linked decision-makers, open opportunities, and interaction logs.
- **Contact Management**: Lightweight, search-first contact database with direct email, phone, and social links.
- **Bulk Action Bar**: Multi-select records for batch status updates, tagging, or export operations.

### 3. Activity Logging & Task Management
- **Omnichannel Logging**: Instant activity tracking for meetings, phone calls, outreach emails, and internal notes.
- **Smart Task Management**: Priority-ranked task queues with due dates, completion toggles, and overdue alerts.
- **Interactive Calendar View**: Unified visual calendar to manage upcoming client follow-ups, demos, and closing deadlines.

### 4. Revenue Forecasting & Analytics
- **Executive Dashboard**: Real-time sales metrics including active pipeline volume, average deal size, win rate, and team velocity.
- **Weighted Revenue Forecasting**: Predictive monthly and quarterly projections based on historical close rates and stage probabilities.
- **Performance Reports**: Deep-dive analytics with interactive funnel visualization and stage conversion velocity charts.

### 5. AI Sales Intelligence (Groq Integration)
- **AI Deal Insights**: Instant summaries of deal momentum and recommended next-best-actions based on activity history.
- **Smart Email Assistance**: Context-aware email drafting tailored to deal stages and prospect personas.

### 6. Administration, Security & Team Collaboration
- **Role-Based Access Control (RBAC)**: Enforce granular access boundaries for Admins, Sales Managers, and Account Executives.
- **Row-Level Security (RLS)**: Database-level isolation powered by PostgreSQL RLS policies to guarantee multi-tenant data safety.
- **Global Search (`Cmd + K`)**: Instant keyboard-driven navigation across deals, contacts, companies, and settings.
- **Interactive Guided Tour**: Built-in interactive onboarding walkthrough to get new sales reps productive on day one.
- **Data Import & Export**: Comprehensive CSV import and export engines for contacts, companies, and deals.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 18, TypeScript, Vite |
| **Styling & Design System** | Tailwind CSS, Radix UI Primitives, Lucide Icons |
| **Data Fetching & State** | TanStack React Query v5 |
| **Charts & Visualizations** | Recharts |
| **Backend & Database** | Supabase (PostgreSQL, Triggers, RLS, Storage) |
| **AI Intelligence** | Groq Cloud API |
| **Testing** | Vitest, Testing Library |

---

## Project Structure

```
├── public/                 # Static assets and icons
├── src/
│   ├── assets/             # Brand logos, avatars, and media
│   ├── components/         # Reusable UI component library
│   │   ├── activities/     # Activity tracking dialogs and feeds
│   │   ├── companies/      # Company cards, tables, and forms
│   │   ├── contacts/       # Contact directory and profile cards
│   │   ├── dashboard/      # KPI summary cards and pipeline charts
│   │   ├── onboarding/     # Onboarding wizard components
│   │   ├── pipeline/       # Kanban board, columns, and deal cards
│   │   ├── settings/       # Profile, team, and pipeline configuration
│   │   ├── tasks/          # Task management components
│   │   └── ui/             # Radix UI / Shadcn primitives
│   ├── contexts/           # AuthContext and global application state
│   ├── hooks/              # Custom business logic hooks (deals, contacts, tasks, etc.)
│   ├── integrations/       # Supabase client and generated schema types
│   ├── lib/                # Utilities, date formatters, sanitizers, and Groq client
│   ├── pages/              # Primary route views (Pipeline, Dashboard, Contacts, etc.)
│   └── test/               # Vitest test suite and mocks
└── supabase/               # Database migrations, RLS policies, and seed scripts
```

---

## Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 1. Clone the Repository
```bash
git clone https://github.com/bethe19/goom-crm.git
cd goom-crm
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the example environment file:
```bash
cp .env.example .env
```

Fill in your configuration parameters:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_GROQ_API_KEY=your_groq_api_key
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## Available Scripts

- `npm run dev` — Launch the Vite development server on port 8080.
- `npm run build` — Compile TypeScript and generate production assets in `dist/`.
- `npm run preview` — Locally preview the production build.
- `npm run test` — Execute Vitest unit and integration test suites.
- `npm run lint` — Run ESLint across the codebase.

---

## Database Architecture & Migrations

The database is built on PostgreSQL via Supabase with full Row-Level Security:

- `supabase/migrations/20260919000001_schema_and_extensions.sql`: Core schema (profiles, organizations, contacts, companies, deals, activities).
- `supabase/migrations/20260919000002_indexes_and_performance.sql`: B-Tree and GIN indexes for low-latency queries.
- `supabase/migrations/20260919000003_functions_and_triggers.sql`: Automated timestamp management and deal stage change audit logs.
- `supabase/migrations/20260919000004_rls_and_security.sql`: Multi-tenant isolation and security policies.
- `supabase/migrations/20260919000005_storage_and_realtime.sql`: Storage buckets and Realtime subscriptions.
- `supabase/seed_goom_construction.sql`: Seed data for demonstration environments.

---

## License

This project is proprietary and confidential. All rights reserved.
