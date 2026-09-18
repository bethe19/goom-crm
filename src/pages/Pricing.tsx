import { useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Menu, X, Sparkles, ShieldCheck } from "lucide-react";


export default function Pricing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const plans = [
    {
      name: "Starter Beta",
      description: "For founders and early-stage teams building their first consistent sales motion.",
      regularPrice: 24,
      features: [
        "Full visual pipeline & kanban",
        "Unlimited active contacts",
        "Email & activity tracking",
        "Interactive revenue forecasting",
        "Goom AI Copilot assistant",
        "Community & direct founder support",
      ],
      cta: "Claim Free Starter Access",
      popular: false,
    },
    {
      name: "Pro & Growth Beta",
      description: "For fast-moving sales teams that need automation, forecasting, and shared visibility.",
      regularPrice: 59,
      features: [
        "Unlimited team members",
        "Unlimited pipelines & custom stages",
        "Full AI Deal Copilot intelligence",
        "Live stage funnel & conversion telemetry",
        "Automated follow-ups & task reminders",
        "Quarterly revenue forecasting",
        "Priority onboarding support",
      ],
      cta: "Claim Free Growth Access",
      popular: true,
    },
    {
      name: "Enterprise Beta",
      description: "For scaled sales organizations requiring advanced security, custom limits, and SLA.",
      regularPrice: 119,
      features: [
        "All Pro & Growth features included",
        "Unlimited pipelines, deals & contacts",
        "Advanced AI Deal Scoring & Risk Radar",
        "Direct founder concierge onboarding",
        "Custom data import & migration tools",
        "Grandfathered early adopter status",
      ],
      cta: "Claim Free Enterprise Access",
      popular: false,
    },
  ];

  const faqs = [
    {
      q: "Is the 15-day trial really free?",
      a: "Yes! Your free trial gives you full access to all features — including the Goom AI Copilot, unlimited pipelines, and advanced analytics. No credit card is required to start.",
    },
    {
      q: "What happens after the 15-day trial?",
      a: "After your trial ends, you can choose a paid plan to continue. We'll remind you before it expires and you'll never be charged without your explicit consent.",
    },
    {
      q: "Will I lose my data if I don't upgrade?",
      a: "Your data stays safe. If you don't upgrade after the trial, your account enters a read-only state for 30 days, giving you time to export or resume at any point.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Absolutely. Cancel with one click from your account settings. No questions asked, no hidden fees, no lock-in contracts.",
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
            <Link to="/solutions" className="transition-colors hover:text-foreground">Solutions</Link>
            <Link to="/customers" className="transition-colors hover:text-foreground">Customers</Link>
            <Link to="/pricing" className="text-foreground font-semibold">Pricing</Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              asChild
              size="sm"
              variant="outline"
              className="hidden sm:inline-flex rounded-lg border-border hover:bg-secondary font-medium text-xs gap-1.5"
            >
              <Link to="/auth?mode=signup">
                <Sparkles className="h-3 w-3 mr-1" />
                Try for Free
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden rounded-lg font-medium sm:inline-flex hover:bg-secondary">
              <Link to="/auth">Log in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-lg bg-foreground text-background font-medium hover:bg-foreground/90 shadow-xs">
              <Link to="/auth?mode=signup">Start Free Trial</Link>
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

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="border-b border-border bg-background px-5 py-4 md:hidden">
            <div className="flex flex-col space-y-3 text-sm font-medium">
              <Link to="/product" className="py-1 text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Product</Link>
              <Link to="/solutions" className="py-1 text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Solutions</Link>
              <Link to="/customers" className="py-1 text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Customers</Link>
              <Link to="/pricing" className="py-1 text-foreground font-semibold" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
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
        <section className="py-14 text-center sm:py-20 px-5 max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400 mb-6 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            <span>15-DAY FREE TRIAL • NO CREDIT CARD REQUIRED</span>
          </div>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl text-foreground">
            All features included.<br />
            Free for 15 days.
          </h1>

          <p className="mt-5 text-base text-muted-foreground max-w-2xl mx-auto sm:text-lg font-normal leading-relaxed">
            Start your free trial in under 60 seconds. Get full access to the visual pipeline, AI Copilot, forecasting, and your entire team — no credit card needed.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-blue-500" />
              No credit card required
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-blue-500" />
              Full access for 15 days
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-blue-500" />
              Cancel anytime, no questions asked
            </span>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="max-w-7xl mx-auto px-5 lg:px-8 pb-20">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col justify-between rounded-2xl border p-8 transition-all duration-200 ${
                  plan.popular
                    ? "border-foreground bg-card shadow-lg ring-1 ring-foreground"
                    : "border-border bg-card shadow-xs hover:border-foreground/40 hover:shadow-md"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-3.5 py-1 text-[11px] font-semibold text-background">
                    Most Popular Beta Tier
                  </div>
                )}

                <div>
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xl font-semibold tracking-tight text-foreground">{plan.name}</h3>
                      <Badge variant="outline" className="text-[10px] font-semibold text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                        FREE NOW
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed min-h-[36px]">
                      {plan.description}
                    </p>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-semibold tracking-tight text-foreground">Free</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        15 days
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-1">
                      Then ${plan.regularPrice}/mo · cancel anytime
                    </p>
                  </div>

                  <Button
                    asChild
                    size="lg"
                    className={`w-full rounded-lg font-medium transition-all ${
                      plan.popular
                        ? "bg-foreground text-background hover:bg-foreground/90 shadow-sm"
                        : "bg-secondary text-foreground hover:bg-foreground hover:text-background"
                    }`}
                  >
                    <Link to="/auth" className="flex items-center justify-center gap-2">
                      <span>{plan.cta}</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>

                  <div className="mt-8 border-t border-border pt-6">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Included in your trial:
                    </p>
                    <ul className="space-y-2.5 text-xs text-foreground">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5">
                          <Check className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                          <span className="leading-tight">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-border/60 text-center">
                  <span className="text-[11px] text-muted-foreground">
                    Setup in under 60 seconds
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQs */}
        <section className="border-t border-border bg-secondary/30 py-20 px-5">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                Frequently Asked Questions
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                Everything you need to know about your free trial.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {faqs.map((faq, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-xs">
                  <h3 className="text-sm font-semibold text-foreground mb-2">{faq.q}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed font-normal">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Goom CRM. Built for modern sales velocity.</p>
      </footer>
    </div>
  );
}
