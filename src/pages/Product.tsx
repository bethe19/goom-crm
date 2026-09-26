import { Link } from "react-router-dom";
import { ArrowRight, Check, Lock, Moon, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CtaBand, MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { InteractiveProductTour } from "@/components/marketing/InteractiveProductTour";
import { plansWithFeature } from "@/components/marketing/tour/data";
import { FEATURES } from "@/components/marketing/features";
import { SIGNUP_PATH } from "@/components/marketing/site";

const FOUNDATIONS = [
  {
    icon: Lock,
    title: "Private workspaces",
    description:
      "Every record belongs to a workspace, and database row-level security limits reads and writes to members of that workspace.",
  },
  {
    icon: ShieldCheck,
    title: "Roles",
    description:
      "Admins manage the workspace and plan, managers see every record and invite reps, and reps work the deals they own or created.",
  },
  {
    icon: Moon,
    title: "Light and dark themes",
    description: "A calm interface that works on desktop and mobile, in light or dark mode.",
  },
];

export default function Product() {
  return (
    <MarketingLayout title="Product">
      <PageHero
        eyebrow="Product"
        title="A focused CRM, without the clutter."
        description="Goom covers the core of selling — pipeline, people, follow-ups and forecasting — and leaves out the rest."
      >
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to={SIGNUP_PATH}>
            Get started free <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
          <Link to="/pricing">View pricing</Link>
        </Button>
      </PageHero>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <InteractiveProductTour />
      </section>

      <section className="border-t border-border bg-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">What's included</p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything you need to close deals, nothing you don't.
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description, points, plan }) => (
              <article key={title} className="flex flex-col rounded-xl border border-border bg-card p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  {plan && (
                    <Link
                      to="/pricing#compare"
                      className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {plansWithFeature(plan)}
                    </Link>
                  )}
                </div>
                <h3 className="mt-4 text-base font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
                <ul className="mt-4 space-y-1.5 border-t border-border pt-4">
                  {points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Built on sensible foundations.</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {FOUNDATIONS.map(({ icon: Icon, title, description }) => (
              <div key={title}>
                <Icon className="h-5 w-5" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-2xl text-sm text-muted-foreground">
            Not included today: email inbox sync, marketing automation, calling, and third-party integrations. If you need
            one of these, <Link to="/contact" className="font-medium text-foreground underline underline-offset-4">tell us</Link>.
          </p>
        </div>
      </section>

      <CtaBand />
    </MarketingLayout>
  );
}
