import { useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { ProductTour } from "@/components/ProductTour";
import {
  ArrowRight,
  Menu,
  X,
  CircleDollarSign,
  UsersRound,
  BarChart3,
  CheckCircle,
  Shield,
  Zap,
} from "lucide-react";

export default function Product() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const capabilities = [
    {
      icon: CircleDollarSign,
      title: "Visual Pipeline Orchestration",
      description:
        "Drag, drop, and advance deals with zero latency. Customize stages to mirror your real-world buying process and inspect velocity per stage.",
      highlights: ["Inline deal creation", "Real-time search & filters", "Stage value aggregations"],
    },
    {
      icon: UsersRound,
      title: "Contact & Account Intelligence",
      description:
        "Every email, note, and deal interaction attached to the contact record automatically. Know who has spoken with whom and when.",
      highlights: ["One-click action triggers", "Status segmentation (Lead, Customer, Partner)", "Timeline history"],
    },
    {
      icon: BarChart3,
      title: "Real-time Forecasting & Insights",
      description:
        "Convert pipeline momentum into reliable quarterly revenue forecasts. Spot drop-offs and rep bottlenecks before the quarter ends.",
      highlights: ["Dynamic quarter comparisons", "Win rate analytics", "Executive-ready exports"],
    },
    {
      icon: Shield,
      title: "Enterprise-grade Data Governance",
      description:
        "Role-based permissions, automated audit logs, and SOC 2 Type II compliant storage so your customer data remains secure at all times.",
      highlights: ["Granular role controls", "End-to-end TLS encryption", "Automated daily backups"],
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
            <Link to="/product" className="text-foreground font-semibold">Product</Link>
            <Link to="/solutions" className="transition-colors hover:text-foreground">Solutions</Link>
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
              <Link to="/product" className="py-1 text-foreground font-semibold" onClick={() => setMobileMenuOpen(false)}>Product</Link>
              <Link to="/solutions" className="py-1 text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Solutions</Link>
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
            Core architecture
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl text-foreground">
            The CRM engine built for speed.
          </h1>
          <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto sm:text-lg font-normal">
            No lag, no cluttered submenus, and no bloated setup cycles. Explore the live interactive tour below.
          </p>
        </section>

        {/* Embedded Interactive Product Tour */}
        <section className="max-w-7xl mx-auto px-5 lg:px-8 pb-24">
          <ProductTour />
        </section>

        {/* Deep Dive Capabilities */}
        <section className="border-t border-border bg-secondary/30 py-24">
          <div className="max-w-7xl mx-auto px-5 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Comprehensive toolset
              </p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
                Everything required to close deals, nothing you don't.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {capabilities.map((cap) => {
                const Icon = cap.icon;
                return (
                  <div
                    key={cap.title}
                    className="rounded-2xl border border-border bg-card p-8 shadow-xs hover:border-foreground/30 transition-all"
                  >
                    <div className="h-10 w-10 rounded-xl bg-foreground text-background flex items-center justify-center mb-6">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight text-foreground mb-2">
                      {cap.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                      {cap.description}
                    </p>
                    <ul className="space-y-2 border-t border-border pt-4">
                      {cap.highlights.map((h) => (
                        <li key={h} className="flex items-center gap-2 text-xs text-foreground/90 font-medium">
                          <CheckCircle className="h-3.5 w-3.5 text-foreground shrink-0" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-border bg-foreground py-16 text-background text-center">
          <div className="max-w-3xl mx-auto px-5">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Experience the difference yourself.
            </h2>
            <p className="mt-3 text-sm text-background/70 max-w-xl mx-auto font-normal">
              Sign up in seconds and see why fast sales teams migrate to Goom.
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
