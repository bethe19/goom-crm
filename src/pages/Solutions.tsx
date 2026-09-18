import { useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { ArrowRight, Menu, X, Rocket, TrendingUp, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function Solutions() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pillars = [
    {
      icon: Rocket,
      badge: "Early-stage & Founders",
      title: "Built for founders who sell before hiring",
      description:
        "When you're validating product-market fit, you don't need 40 required fields. You need a fast, calm place to record conversation outcomes, send proposals, and track early checks.",
      points: [
        "Zero-friction deal entry in under 10 seconds",
        "Clear stage pipeline from initial intro to signed contract",
        "Shared context across co-founders without messy spreadsheets",
      ],
      stat: "10 hrs",
      statLabel: "saved per week on admin overhead",
    },
    {
      icon: TrendingUp,
      badge: "High-Velocity Sales Teams",
      title: "Keep reps focused on closing, not logging data",
      description:
        "Sales reps hate bloated legacy tools. Goom is engineered like a high-performance productivity tool: fast keyboard shortcuts, inline editing, and automated next-step prompts.",
      points: [
        "One-click stage advancements and instant contact search",
        "Automated reminders so high-intent leads never go cold",
        "Eliminates end-of-week data cleanup marathons",
      ],
      stat: "2.4x",
      statLabel: "increase in deal velocity across teams",
    },
    {
      icon: ShieldCheck,
      badge: "Sales Leaders & Executives",
      title: "Predictable revenue without interrogating your team",
      description:
        "Get live visibility into pipeline health and deal progression. Spot stalled opportunities early and forecast quarterly revenue accurately without demanding manual weekly reports.",
      points: [
        "Live forecast rollups updated from rep activity in real time",
        "Historical conversion rates and bottleneck detection",
        "Executive-ready export formats for board and investor updates",
      ],
      stat: "+38%",
      statLabel: "forecast accuracy within 60 days",
    },
  ];

  return (
    <div className="force-light min-h-screen bg-background text-foreground antialiased selection:bg-foreground selection:text-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md transition-all">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8" aria-label="Main navigation">
          <Link to="/" className="transition-opacity hover:opacity-90">
            <Brand size="md" />
          </Link>
          <div className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <Link to="/product" className="transition-colors hover:text-foreground">Product</Link>
            <Link to="/solutions" className="text-foreground font-semibold">Solutions</Link>
            <Link to="/customers" className="transition-colors hover:text-foreground">Customers</Link>
            <Link to="/pricing" className="transition-colors hover:text-foreground">Pricing</Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" size="sm" className="hidden rounded-lg font-medium sm:inline-flex hover:bg-secondary">
              <Link to="/auth">Log in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-lg bg-foreground text-background font-medium hover:bg-foreground/90 shadow-xs">
              <Link to="/auth">Start for free</Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </nav>

        {mobileMenuOpen && (
          <div className="border-b border-border bg-background px-5 py-4 md:hidden">
            <div className="flex flex-col space-y-3 text-sm font-medium">
              <Link to="/product" className="py-1 text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Product</Link>
              <Link to="/solutions" className="py-1 text-foreground font-semibold" onClick={() => setMobileMenuOpen(false)}>Solutions</Link>
              <Link to="/customers" className="py-1 text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Customers</Link>
              <Link to="/pricing" className="py-1 text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
              <Link to="/contact" className="py-1 text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Contact</Link>
              <div className="pt-2 border-t border-border flex flex-col gap-2">
                <Button asChild variant="outline" size="sm" className="w-full justify-center">
                  <Link to="/auth">Log in</Link>
                </Button>
                <Button asChild size="sm" className="w-full justify-center bg-foreground text-background">
                  <Link to="/auth">Start for free</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 text-center sm:py-24 px-5 max-w-5xl mx-auto">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Tailored to your sales motion
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl text-foreground">
            Solutions designed for every stage of growth.
          </h1>
          <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto sm:text-lg font-normal">
            Whether you're closing your first 10 enterprise logos or coordinating a team of 30 quota-carrying reps, Goom scales with your execution.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg" className="h-11 rounded-lg bg-foreground px-7 text-background font-semibold hover:bg-foreground/90 shadow-sm">
              <Link to="/auth">
                Get started today <ArrowRight className="h-4 w-4 ml-1.5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 rounded-lg px-7 font-semibold">
              <Link to="/contact">Book a demo</Link>
            </Button>
          </div>
        </section>

        {/* Pillars */}
        <section className="max-w-7xl mx-auto px-5 lg:px-8 pb-24 space-y-16">
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.badge}
                className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-10 items-center rounded-2xl border border-border bg-card p-8 sm:p-12 shadow-xs"
              >
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs font-semibold text-foreground mb-4">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{pillar.badge}</span>
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl text-foreground">
                    {pillar.title}
                  </h2>
                  <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                    {pillar.description}
                  </p>

                  <ul className="mt-6 space-y-3 text-xs text-foreground/90">
                    {pillar.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-foreground mt-0.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    <Button asChild variant="outline" size="sm" className="rounded-lg font-medium">
                      <Link to="/auth">
                        Explore for {pillar.badge.split(" ")[0]} <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-secondary/20 p-8 text-center sm:p-12">
                  <span className="text-5xl sm:text-6xl font-semibold tracking-tight text-foreground">
                    {pillar.stat}
                  </span>
                  <span className="mt-2 text-xs font-medium text-muted-foreground uppercase tracking-wider max-w-[200px]">
                    {pillar.statLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-border bg-foreground py-16 text-background text-center">
          <div className="max-w-3xl mx-auto px-5">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to see Goom in action?
            </h2>
            <p className="mt-3 text-sm text-background/70 max-w-xl mx-auto font-normal">
              Get set up in under two minutes with no credit card required.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Button asChild size="lg" className="h-11 rounded-lg bg-background px-7 text-foreground font-semibold hover:bg-background/90 shadow-sm">
                <Link to="/auth">
                  Start for free <ArrowRight className="h-4 w-4 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-background/10 bg-foreground py-12 text-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <Brand size="md" inverse />
          <div className="flex flex-wrap gap-6 text-sm font-medium text-background/70">
            <Link to="/product" className="hover:text-background transition-colors">Product</Link>
            <Link to="/solutions" className="hover:text-background transition-colors">Solutions</Link>
            <Link to="/customers" className="hover:text-background transition-colors">Customers</Link>
            <Link to="/pricing" className="hover:text-background transition-colors">Pricing</Link>
            <Link to="/contact" className="hover:text-background transition-colors">Contact</Link>
            <Link to="/privacy" className="hover:text-background transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-background transition-colors">Terms</Link>
          </div>
          <p className="text-xs text-background/40">© {new Date().getFullYear()} Goom Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
