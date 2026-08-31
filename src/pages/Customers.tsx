import { useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { ArrowRight, Menu, X, Quote } from "lucide-react";

export default function Customers() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const stories = [
    {
      company: "Northstar Labs",
      metric: "+42%",
      metricLabel: "Quarterly close rate",
      quote:
        "Goom cut our daily CRM administration by more than half. The visual pipeline is so intuitive our sales reps actually keep it up to date without being asked.",
      author: "Maya Chen",
      role: "VP of Sales, Northstar Labs",
      industry: "Enterprise AI Infrastructure",
    },
    {
      company: "Arc Systems",
      metric: "3x",
      metricLabel: "Faster rep ramp time",
      quote:
        "Legacy CRMs felt like filling out tax forms. Goom gives us the clarity of an executive spreadsheet combined with real-time deal stage tracking.",
      author: "Noah Williams",
      role: "Head of Revenue, Arc Systems",
      industry: "DevOps & Cloud Security",
    },
    {
      company: "Harbor & Co.",
      metric: "$2.4M",
      metricLabel: "Added pipeline in 90 days",
      quote:
        "The automated follow-ups ensure that high-ticket proposals never slip through the cracks. It's the highest ROI software investment our team made this year.",
      author: "Sofia Miller",
      role: "Chief Commercial Officer, Harbor & Co.",
      industry: "Fintech & Wealth Operations",
    },
    {
      company: "Atlas Works",
      metric: "18 days",
      metricLabel: "Average sales cycle (down from 34)",
      quote:
        "Knowing exactly who needs a follow-up and having one-click email actions saved our sales team hundreds of hours this quarter alone.",
      author: "Amara Davis",
      role: "Director of Business Development, Atlas Works",
      industry: "Logistics Automation",
    },
    {
      company: "Orchid Health",
      metric: "99.4%",
      metricLabel: "Data accuracy across deals",
      quote:
        "Our previous CRM had hundreds of unused custom fields. Goom streamlined everything down to what truly drives conversions.",
      author: "Theo Martin",
      role: "Growth Lead, Orchid Health",
      industry: "Healthcare Software",
    },
    {
      company: "Cedar",
      metric: "100%",
      metricLabel: "Team adoption in week one",
      quote:
        "We migrated from our old system in an afternoon and the entire team was productive before dinner. Unbelievably smooth experience.",
      author: "Elena Vance",
      role: "Co-founder & COO, Cedar",
      industry: "Supply Chain Intelligence",
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
            <Link to="/customers" className="text-foreground font-semibold">Customers</Link>
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
              <Link to="/solutions" className="py-1 text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Solutions</Link>
              <Link to="/customers" className="py-1 text-foreground font-semibold" onClick={() => setMobileMenuOpen(false)}>Customers</Link>
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
            Customer stories
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl text-foreground">
            Teams that win with Goom.
          </h1>
          <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto sm:text-lg font-normal">
            Discover how forward-thinking revenue teams eliminate administrative waste and accelerate deal progression.
          </p>
        </section>

        {/* Stories Grid */}
        <section className="max-w-7xl mx-auto px-5 lg:px-8 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {stories.map((s) => (
              <div
                key={s.company}
                className="flex flex-col rounded-2xl border border-border bg-card p-8 shadow-xs hover:shadow-md hover:border-foreground/30 transition-all"
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {s.industry}
                  </span>
                  <span className="font-semibold text-sm text-foreground">{s.company}</span>
                </div>

                <div className="mb-6 rounded-xl bg-secondary/30 p-4 border border-border/60">
                  <span className="text-3xl font-semibold tracking-tight text-foreground block">
                    {s.metric}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    {s.metricLabel}
                  </span>
                </div>

                <div className="relative mb-6 flex-1">
                  <Quote className="h-5 w-5 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground leading-relaxed italic">
                    "{s.quote}"
                  </p>
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold text-foreground">{s.author}</p>
                  <p className="text-[11px] text-muted-foreground">{s.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-border bg-foreground py-16 text-background text-center">
          <div className="max-w-3xl mx-auto px-5">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Write your own growth story.
            </h2>
            <p className="mt-3 text-sm text-background/70 max-w-xl mx-auto font-normal">
              Get your entire sales pipeline running cleanly in less than ten minutes.
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
