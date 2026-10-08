import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { InteractiveProductTour } from "@/components/marketing/InteractiveProductTour";
import { FEATURES } from "@/components/marketing/features";
import { SIGNUP_PATH } from "@/components/marketing/site";

const STEPS = [
  {
    title: "Create your workspace",
    description: "Sign up and you get a private workspace with a ready-to-edit sales pipeline.",
  },
  {
    title: "Bring in your data",
    description: "Import contacts, companies and deals from a CSV, or add them by hand.",
  },
  {
    title: "Invite your team",
    description: "Send invitation links and choose each person's role: admin, manager or rep.",
  },
];

const HIGHLIGHTS = FEATURES.filter((f) =>
  ["Pipeline board", "Contacts and companies", "Tasks", "Forecast", "Team workspaces", "AI assistant"].includes(f.title),
);

export default function Landing() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Navigate to="/dashboard" replace />;

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">CRM for small sales teams</p>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            Turn relationships into revenue
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Goom gives your team one clear place to track deals, keep follow-ups moving, and see what's likely to close.
          </p>
          <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link to={SIGNUP_PATH}>
                Get started free <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#tour">Take the tour</a>
            </Button>
          </div>
          <div id="tour" className="mt-14 scroll-mt-20 sm:mt-16">
            <InteractiveProductTour />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-border bg-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">One connected workspace</p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything a small team needs to run its pipeline.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Deals, the people behind them, and the next step for each — in one place your whole team can see.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-xl border border-border bg-card p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
          <div className="mt-8">
            <Button asChild variant="outline">
              <Link to="/product">
                See every feature <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* AI assistant */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Built-in assistant</p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Ask your pipeline a question.</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              The assistant reads your current deals, tasks and recent activity when you ask, and answers from that data — no
              made-up numbers.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Summarize the pipeline by stage",
                "Spot deals past their close date or gone quiet",
                "Draft a follow-up email you can copy and edit",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div aria-hidden="true" className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <span className="text-sm font-semibold">Assistant</span>
            </div>
            <div className="space-y-4 pt-4 text-sm">
              <div className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-foreground px-3 py-2 text-background">
                Which deals are at risk?
              </div>
              <div className="space-y-2 text-foreground/90">
                <p>Two open deals need attention:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <strong>Warehouse fit-out</strong> — close date passed 6 days ago.
                  </li>
                  <li>
                    <strong>Annual support plan</strong> — no updates for 21 days.
                  </li>
                </ul>
              </div>
            </div>
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Illustration with example data.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border bg-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Up and running in minutes.</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-border bg-card p-6">
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">Step {i + 1}</span>
                <h3 className="mt-2 text-base font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CtaSection />
    </MarketingLayout>
  );
}

function CtaSection() {
  return (
    <section className="bg-foreground text-background">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">A CRM your team will actually use.</h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-background/70 sm:text-base">
          Keep every deal visible and spend less time updating spreadsheets.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-background text-foreground hover:bg-background/90">
            <Link to={SIGNUP_PATH}>
              Get started free <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-background/25 bg-transparent text-background hover:bg-background/10 hover:text-background"
          >
            <Link to="/pricing">View pricing</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
