import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Check, Info, KanbanSquare, Minus, Sparkles, UsersRound, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { signupPathFor } from "@/components/marketing/site";
import { plansWithFeature } from "@/components/marketing/tour/data";
import { cn } from "@/lib/utils";
import {
  FEATURE_LABELS,
  PLANS,
  PLAN_ORDER,
  TRIAL_AI_REQUESTS_PER_MONTH,
  TRIAL_DAYS,
  formatLimit,
  planHasFeature,
  type Plan,
  type PlanFeature,
  type PlanId,
  type PlanLimits,
} from "@/lib/plans";

/** Our suggestion for most teams (a recommendation, not a popularity claim). */
const RECOMMENDED: PlanId = "growth";

const LIMIT_ROWS: { key: keyof PlanLimits; label: string; icon: typeof UserRound }[] = [
  { key: "seats", label: "Users", icon: UserRound },
  { key: "pipelines", label: "Pipelines", icon: KanbanSquare },
  { key: "contacts", label: "Contacts", icon: UsersRound },
  { key: "ai_requests_per_month", label: "AI requests / month", icon: Sparkles },
];

/* ------------------------------------------------------------ comparison */

type Cell = boolean | string;

interface CompareRow {
  label: string;
  hint?: string;
  value: (plan: Plan) => Cell;
}

interface CompareGroup {
  title: string;
  rows: CompareRow[];
}

const everyPlan = (label: string, hint?: string): CompareRow => ({ label, hint, value: () => true });
const featureRow = (feature: PlanFeature, hint?: string): CompareRow => ({
  label: FEATURE_LABELS[feature],
  hint,
  value: (plan) => planHasFeature(plan.id, feature),
});
const limitRow = (key: keyof PlanLimits, label: string, hint?: string): CompareRow => ({
  label,
  hint,
  value: (plan) => formatLimit(plan.limits[key]),
});

const COMPARE: CompareGroup[] = [
  {
    title: "Limits",
    rows: [
      limitRow("seats", "Users", "Members plus pending invitations"),
      limitRow("pipelines", "Pipelines"),
      limitRow("contacts", "Contacts"),
    ],
  },
  {
    title: "Sales pipeline",
    rows: [
      everyPlan("Drag-and-drop pipeline board", "Custom stages, won and lost stages"),
      everyPlan("Deals, contacts and companies"),
      everyPlan("Activities and tasks", "Calls, emails, meetings, notes; due dates and priorities"),
      everyPlan("Calendar", "Tasks, activities and expected close dates"),
      everyPlan("Command palette", "Ctrl K / ⌘K to search and jump anywhere"),
      everyPlan("Bulk actions"),
    ],
  },
  {
    title: "Insights",
    rows: [
      everyPlan("Dashboard KPIs", "Pipeline value, win rate, deals by stage"),
      featureRow("forecast", "Commit and best case by month against quota"),
      featureRow("advanced_reports", "Period comparison, leaderboard, lost reasons, activity mix"),
    ],
  },
  {
    title: "Data",
    rows: [
      featureRow("csv_import", "Guided import of contacts, companies and deals"),
      featureRow("csv_export"),
      featureRow("workspace_backup", "Every record in one JSON file"),
    ],
  },
  {
    title: "AI",
    rows: [
      everyPlan("AI assistant", "Answers from your deals, tasks and recent activity"),
      limitRow("ai_requests_per_month", "AI requests / month", "Shared by the whole workspace"),
    ],
  },
  {
    title: "Security & admin",
    rows: [
      everyPlan("Private workspace", "Row-level security keeps data inside your workspace"),
      everyPlan("Roles and permissions", "Admin, manager and rep; reps see their own deals"),
      everyPlan("Invitation links"),
      featureRow("audit_history", "Every change to a deal and who made it"),
    ],
  },
  {
    title: "Support",
    rows: [everyPlan("Email support"), featureRow("priority_support", "Your requests are answered first")],
  },
];

function CellValue({ value, emphasize }: { value: Cell; emphasize?: boolean }) {
  if (value === true)
    return (
      <>
        <Check className={cn("h-4 w-4", emphasize ? "text-foreground" : "text-foreground/80")} aria-hidden="true" />
        <span className="sr-only">Included</span>
      </>
    );
  if (value === false)
    return (
      <>
        <Minus className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
        <span className="sr-only">Not included</span>
      </>
    );
  return <span className="text-sm font-medium tabular-nums">{value}</span>;
}

/* ------------------------------------------------------------------ FAQ */

const money = (n: number) => `$${n}`;
const priceList = PLAN_ORDER.map((id) => `${PLANS[id].name} ${money(PLANS[id].price)}`).join(", ");

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: "How does the free trial work?",
    a: `Every new workspace gets a ${TRIAL_DAYS}-day free trial, no card required. During the trial, workspace admins can switch between Starter, Growth and Enterprise in Settings as often as they like, and the plan's limits and features apply straight away. Trials include up to ${formatLimit(TRIAL_AI_REQUESTS_PER_MONTH)} AI assistant requests a month.`,
  },
  {
    q: "How do we pay?",
    a: `Before the trial ends, an admin chooses a plan in Settings → Plan & usage and requests it. We email payment details for an invoice or bank transfer, and activate the plan as soon as payment is confirmed. Prices per workspace per month: ${priceList}. We never ask for a card, so nothing is charged automatically.`,
  },
  {
    q: "What happens if the trial ends before we pay?",
    a: "Your workspace is paused, not deleted. Your data is kept, but nobody can open the workspace until a plan is active. Once payment is confirmed it reopens exactly as you left it. The same applies if a paid period ends without being renewed.",
  },
  {
    q: "How do limits work?",
    a: "Limits apply to the whole workspace, not to each person. Users counts members plus pending invitations. Pipelines and contacts count what's stored in the workspace. AI requests are shared by the team and reset at the start of each calendar month (UTC).",
  },
  {
    q: "What happens when we reach a limit?",
    a: "Nothing is deleted or locked. You keep full access to your existing records; only adding more (another contact, pipeline or teammate, or another AI request that month) is blocked, with a message saying which limit was reached. An admin can then upgrade, or you can free up room.",
  },
  {
    q: "Can we switch plans later?",
    a: "Yes. During the trial, admins can switch freely. On a paid plan, an admin can move to a smaller plan from Settings at any time, as long as current usage fits within its limits (if it doesn't, we tell you which limit is over so you can tidy up first). Upgrades are requested in Settings and start as soon as payment is confirmed.",
  },
  {
    q: "Can I export my data?",
    a: `CSV export of contacts, companies and deals is included on ${plansWithFeature("csv_export")}, and ${plansWithFeature("workspace_backup")} adds a full workspace backup. During the free trial an admin can switch to any plan, so you can try export before you pay.`,
  },
  {
    q: "Which plan should I choose when I sign up?",
    a: "Pick the one that matches your team today — you can switch freely during the free trial. Every plan includes the pipeline, contacts, tasks, calendar, roles and the AI assistant; the differences are the limits and the extra insight, data and history features shown in the comparison above.",
  },
];

/* ------------------------------------------------------------------ page */

export default function Pricing() {
  const { hash } = useLocation();
  const [mobilePlan, setMobilePlan] = useState<PlanId>(RECOMMENDED);

  // MarketingLayout scrolls to the top on mount; honor links like /pricing#compare afterwards.
  useEffect(() => {
    if (!hash) return;
    const t = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView(), 50);
    return () => window.clearTimeout(t);
  }, [hash]);

  return (
    <MarketingLayout title="Pricing">
      <PageHero
        eyebrow="Pricing"
        title="Plans that grow with your team."
        description="Every plan includes the pipeline, contacts, tasks, calendar, roles and the AI assistant. Higher plans add room to grow, forecasting, reporting, data tools and full history."
      />

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl gap-3 rounded-xl border border-border bg-secondary/50 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="text-foreground/85">
            <span className="font-medium text-foreground">{TRIAL_DAYS}-day free trial, no card required.</span> Try any plan and switch
            between them as you like. When you're ready, choose a plan and pay by invoice or bank transfer — we activate it as soon as
            payment is confirmed.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {PLAN_ORDER.map((id) => (
            <PlanCard key={id} plan={PLANS[id]} recommended={id === RECOMMENDED} />
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Not sure yet?{" "}
          <a href="#compare" className="font-medium text-foreground underline underline-offset-4">
            Compare every feature
          </a>
        </p>
      </section>

      {/* Comparison */}
      <section id="compare" className="mt-20 scroll-mt-20 border-t border-border bg-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Compare plans</p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">What's in each plan.</h2>
          </div>

          {/* Desktop table */}
          <table className="mt-10 hidden w-full border-separate border-spacing-0 text-left md:table">
            <caption className="sr-only">Feature comparison of the Starter, Growth and Enterprise plans</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky top-16 z-10 w-[34%] border-b border-border bg-secondary py-4 pl-4 align-bottom text-sm font-medium text-muted-foreground">
                  Features
                </th>
                {PLAN_ORDER.map((id) => {
                  const plan = PLANS[id];
                  return (
                    <th
                      key={id}
                      scope="col"
                      className={cn(
                        "sticky top-16 z-10 border-b border-border bg-secondary px-4 py-4 align-bottom",
                        id === RECOMMENDED && "bg-card",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold">{plan.name}</span>
                        {id === RECOMMENDED && (
                          <span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-medium text-background">Recommended</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm font-normal text-muted-foreground">
                        Free for {TRIAL_DAYS} days, then <span className="tabular-nums">{money(plan.price)}</span>/month
                      </p>
                      <Button asChild size="sm" variant={id === RECOMMENDED ? "default" : "outline"} className="mt-3 w-full">
                        <Link to={signupPathFor(id)}>Try {plan.name} free</Link>
                      </Button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            {COMPARE.map((group) => (
              <tbody key={group.title}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={4}
                    className="border-b border-border pb-2 pl-4 pt-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {group.title}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="border-b border-border py-3 pl-4 pr-4 align-top font-normal">
                      <span className="text-sm">{row.label}</span>
                      {row.hint && <span className="mt-0.5 block text-xs text-muted-foreground">{row.hint}</span>}
                    </th>
                    {PLAN_ORDER.map((id) => (
                      <td key={id} className={cn("border-b border-border px-4 py-3 align-top", id === RECOMMENDED && "bg-card")}>
                        <CellValue value={row.value(PLANS[id])} emphasize={id === RECOMMENDED} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>

          {/* Mobile: one plan at a time */}
          <div className="mt-8 md:hidden">
            <div role="tablist" aria-label="Choose a plan to compare" className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1">
              {PLAN_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`compare-tab-${id}`}
                  aria-selected={mobilePlan === id}
                  aria-controls="compare-panel"
                  onClick={() => setMobilePlan(id)}
                  className={cn(
                    "rounded-lg px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    mobilePlan === id ? "bg-foreground text-background" : "text-muted-foreground",
                  )}
                >
                  {PLANS[id].name}
                </button>
              ))}
            </div>
            <div id="compare-panel" role="tabpanel" aria-labelledby={`compare-tab-${mobilePlan}`} className="mt-4 space-y-6">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="font-semibold">{PLANS[mobilePlan].name}</p>
                  <p className="text-sm text-muted-foreground">
                    Free for {TRIAL_DAYS} days, then <span className="tabular-nums">{money(PLANS[mobilePlan].price)}</span>/month
                  </p>
                </div>
                <Button asChild size="sm" variant={mobilePlan === RECOMMENDED ? "default" : "outline"}>
                  <Link to={signupPathFor(mobilePlan)}>Try {PLANS[mobilePlan].name} free</Link>
                </Button>
              </div>
              {COMPARE.map((group) => (
                <section key={group.title} aria-label={group.title}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</h3>
                  <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                    {group.rows.map((row) => (
                      <li key={row.label} className="flex items-start justify-between gap-4 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm">{row.label}</p>
                          {row.hint && <p className="mt-0.5 text-xs text-muted-foreground">{row.hint}</p>}
                        </div>
                        <div className="shrink-0 pt-0.5">
                          <CellValue value={row.value(PLANS[mobilePlan])} emphasize />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <h2 className="text-balance text-center text-3xl font-semibold tracking-tight">Questions</h2>
          <Accordion type="single" collapsible className="mt-10 rounded-xl border border-border bg-card px-5">
            {FAQS.map((f, i) => (
              <AccordionItem key={f.q} value={`faq-${i}`} className={i === FAQS.length - 1 ? "border-b-0" : undefined}>
                <AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Still have a question?{" "}
            <Link to="/contact" className="font-medium text-foreground underline underline-offset-4">
              Send us a message
            </Link>
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}

function PlanCard({ plan, recommended }: { plan: Plan; recommended: boolean }) {
  return (
    <article
      aria-labelledby={`plan-${plan.id}`}
      className={cn(
        "relative flex flex-col rounded-xl border bg-card p-6 sm:p-8",
        recommended ? "border-foreground shadow-md" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={`plan-${plan.id}`} className="text-lg font-semibold tracking-tight">
          {plan.name}
        </h2>
        {recommended && <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-medium text-background">Recommended</span>}
      </div>
      <p className="mt-2 text-sm text-muted-foreground lg:min-h-[60px]">{plan.tagline}</p>

      <p className="mt-6 text-sm font-medium text-foreground">{TRIAL_DAYS}-day free trial, no card required</p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-sm text-muted-foreground">then</span>
        <span className="text-4xl font-semibold tracking-tight tabular-nums">{money(plan.price)}</span>
        <span className="text-sm text-muted-foreground">/ month per workspace</span>
      </div>

      <Button asChild className="mt-6 w-full" variant={recommended ? "default" : "outline"}>
        <Link to={signupPathFor(plan.id)}>
          Try {plan.name} free <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>

      <dl className="mt-6 divide-y divide-border rounded-lg bg-secondary/50 px-4">
        {LIMIT_ROWS.map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between gap-3 py-2.5">
            <dt className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </dt>
            <dd className="text-sm font-semibold tabular-nums">{formatLimit(plan.limits[key])}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-6 space-y-2.5">
        {plan.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2.5 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
