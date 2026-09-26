import { Link } from "react-router-dom";
import { ArrowRight, Check, Compass, Crown, Rocket, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CtaBand, MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { SIGNUP_PATH } from "@/components/marketing/site";

const ROLES = [
  {
    icon: Rocket,
    badge: "Founders",
    title: "Selling before you've hired a sales team",
    description:
      "You don't need forty required fields. You need a quick place to record conversations, see where each opportunity stands and remember the next step.",
    points: [
      "A ready-made pipeline you can rename and reorder",
      "Deals linked to the contact and company behind them",
      "Import the spreadsheet you've been using so far",
    ],
  },
  {
    icon: Target,
    badge: "Sales reps",
    title: "Less admin, more selling",
    description:
      "Move deals by dragging them between stages, log a call in a few clicks, and keep your tasks for the week in one list.",
    points: [
      "Kanban pipeline with stage totals",
      "Tasks with due dates and priorities",
      "Ctrl+K to find any record instantly",
    ],
  },
  {
    icon: Crown,
    badge: "Sales leaders",
    title: "See the pipeline without chasing updates",
    description:
      "Reports and the forecast are built from the deals your team already keeps up to date, so you can see where things stand in one place.",
    points: [
      "Forecast from open deals and expected close dates",
      "Stage conversion and win-rate reports",
      "Ask the assistant which deals need attention",
    ],
  },
  {
    icon: Compass,
    badge: "Workspace admins",
    title: "Simple to set up and manage",
    description: "Create the workspace, invite teammates with the right role, and control your pipeline stages and currency.",
    points: [
      "Admin, manager and rep roles",
      "Invitation links for new teammates",
      "Switch plans in-app as the team grows",
    ],
  },
];

export default function Solutions() {
  return (
    <MarketingLayout title="Solutions">
      <PageHero
        eyebrow="Solutions"
        title="Fits the way small teams sell."
        description="Whether you're the only person selling or you lead a small team, Goom keeps the essentials in one place."
      >
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to={SIGNUP_PATH}>
            Get started free <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
          <Link to="/product">See the product</Link>
        </Button>
      </PageHero>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
        <div className="grid gap-4 md:grid-cols-2">
          {ROLES.map(({ icon: Icon, badge, title, description, points }) => (
            <article key={badge} className="flex flex-col rounded-xl border border-border bg-card p-6 sm:p-8">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-medium">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {badge}
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight">{title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
              <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
                {points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <CtaBand />
    </MarketingLayout>
  );
}
