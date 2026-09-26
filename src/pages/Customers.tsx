import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, Check, HardHat, Laptop, Minus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CtaBand, MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { SIGNUP_PATH } from "@/components/marketing/site";

const USE_CASES = [
  {
    icon: Briefcase,
    title: "Agencies and professional services",
    description:
      "Track proposals from first call to signed engagement, keep client contacts and companies together, and log every meeting.",
    how: ["Stages like Discovery → Proposal → Negotiation → Won", "Activities for calls, meetings and notes", "Tasks for proposal follow-ups"],
  },
  {
    icon: HardHat,
    title: "Project-based businesses",
    description:
      "For bids, quotes and tenders with long lead times: see every open project by stage, its value and its expected close date.",
    how: ["Deal values and close dates on the forecast", "Calendar of close dates and tasks", "Notes that stay with each deal"],
  },
  {
    icon: Laptop,
    title: "Early-stage B2B startups",
    description: "Founder-led sales without a heavyweight CRM: move off spreadsheets and keep one shared view of the pipeline.",
    how: ["CSV import of your existing list", "Invite co-founders and first hires", "Ask the assistant to summarize the pipeline"],
  },
  {
    icon: Users,
    title: "Small in-house sales teams",
    description: "A shared pipeline for a handful of reps and a manager, with roles and reports built from the same data.",
    how: ["Admin, manager and rep roles", "Win-rate and stage conversion reports", "Workspace currency and quota settings"],
  },
];

const NOT_YET = [
  "Two-way email or calendar sync",
  "Marketing automation and email campaigns",
  "Built-in calling or SMS",
  "Third-party integrations and a public API",
  "Custom objects and custom fields",
  "Single sign-on (SSO)",
];

export default function Customers() {
  return (
    <MarketingLayout title="Use cases">
      <PageHero
        eyebrow="Use cases"
        title="Who Goom is for."
        description="Goom is built for small teams that sell B2B and want a clear pipeline without a complicated setup."
      >
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to={SIGNUP_PATH}>
            Get started free <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </PageHero>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2">
          {USE_CASES.map(({ icon: Icon, title, description, how }) => (
            <article key={title} className="flex flex-col rounded-xl border border-border bg-card p-6 sm:p-8">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight">{title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
              <h3 className="mt-5 border-t border-border pt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                How teams set it up
              </h3>
              <ul className="mt-3 space-y-2">
                {how.map((h) => (
                  <li key={h} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-secondary/30">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight">Probably not the right fit (yet).</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              We'd rather tell you up front. Goom doesn't currently offer the following — if one is a must-have for you,
              a larger CRM may suit you better today.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {NOT_YET.map((n) => (
              <li key={n} className="flex items-start gap-2.5 rounded-lg border border-border bg-card px-4 py-3 text-sm">
                <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand title="Sound like your team?" />
    </MarketingLayout>
  );
}
