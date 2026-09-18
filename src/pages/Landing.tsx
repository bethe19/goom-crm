import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Brand";
import { ProductTour } from "@/components/ProductTour";
import {
  ArrowRight,
  ChevronRight,
  Check,
  Menu,
  X,
  Sparkles,
} from "lucide-react";

const features = [
  {
    number: "01",
    title: "See every deal clearly",
    copy: "A visual pipeline gives your whole team one honest view of what is moving, what is stuck, and what closes next.",
  },
  {
    number: "02",
    title: "Keep follow-ups moving",
    copy: "Tasks, notes, and activity live with the deal, so the next step is always obvious and nothing slips through the cracks.",
  },
  {
    number: "03",
    title: "Forecast with confidence",
    copy: "Turn live pipeline activity into a reliable revenue picture without exporting another spreadsheet.",
  },
];

export default function Landing() {
  const { session, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!loading && session) return <Navigate to="/dashboard" replace />;

  const scrollToProduct = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById("product");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="force-light min-h-screen overflow-x-hidden bg-background text-foreground antialiased selection:bg-foreground selection:text-background">
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
            <Link to="/pricing" className="transition-colors hover:text-foreground">Pricing</Link>
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
              <Link to="/pricing" className="py-1 text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
              <Link to="/contact" className="py-1 text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Contact</Link>
              <div className="pt-2 border-t border-border flex flex-col gap-2">
                <Button asChild variant="outline" size="sm" className="w-full justify-center">
                  <Link to="/auth">Log in</Link>
                </Button>
                <Button asChild size="sm" className="w-full justify-center bg-foreground text-background">
                  <Link to="/auth?mode=signup">Start Free Trial</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative border-b border-border bg-[linear-gradient(hsl(var(--border)/0.35)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.35)_1px,transparent_1px)] bg-[size:64px_64px]">
          <div className="mx-auto max-w-7xl px-5 pb-16 pt-16 text-center sm:pt-24 lg:px-8 lg:pt-28">
            <button
              onClick={scrollToProduct}
              type="button"
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-xs hover:border-foreground/30 hover:text-foreground transition-all cursor-pointer"
            >
              <span className="rounded-full bg-secondary px-2 py-0.5 text-foreground font-semibold">New</span>
              The faster way to run your pipeline
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <h1 className="mx-auto max-w-4xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
              Turn relationships into revenue
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg font-normal">
              Goom gives modern sales teams one clear place to manage deals, stay close to customers, and close with confidence.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 w-full rounded-lg bg-foreground text-background font-semibold hover:bg-foreground/90 shadow-sm transition-all sm:w-auto flex items-center justify-center gap-2"
              >
                <Link to="/auth?mode=signup">
                  <Sparkles className="h-4 w-4" />
                  Try for Free — 15 Days
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 w-full rounded-lg bg-background px-8 font-semibold shadow-xs hover:bg-secondary/60 sm:w-auto">
                <Link to="/auth">
                  Log in <ArrowRight className="h-4 w-4 ml-1.5" />
                </Link>
              </Button>
            </div>

            {/* Product Tour Interactive Section */}
            <div id="product" className="mt-16 scroll-mt-20 sm:mt-20">
              <ProductTour />
            </div>
          </div>
        </section>

        {/* Customer Social Proof */}
        <section id="customers" className="border-b border-border bg-background py-14">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Built for teams that value momentum
            </p>
            <div className="grid grid-cols-2 gap-7 text-center text-base font-semibold text-muted-foreground/80 sm:grid-cols-3 lg:grid-cols-6">
              {['Northstar', 'Arc', 'Cedar', 'Harbor', 'Atlas', 'Orchid'].map((name) => (
                <Link
                  key={name}
                  to="/customers"
                  className="rounded-lg py-2 transition-colors hover:text-foreground"
                >
                  {name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Solutions / Features Section */}
        <section id="solutions" className="border-b border-border bg-secondary/30 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
              <div>
                <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  One connected workspace
                </p>
                <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                  Sales isn’t about updating a CRM. It’s about moving forward.
                </h2>
                <div className="mt-8">
                  <Button asChild variant="outline" size="sm" className="rounded-lg font-medium">
                    <Link to="/solutions">
                      Learn more about solutions <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="divide-y divide-border border-y border-border">
                {features.map((feature) => (
                  <article
                    key={feature.number}
                    className="grid gap-4 py-8 sm:grid-cols-[48px_1fr] transition-colors hover:bg-background/40 rounded-xl px-4 -mx-4"
                  >
                    <span className="font-mono text-xs font-semibold text-muted-foreground">{feature.number}</span>
                    <div>
                      <h3 className="mb-2 text-lg font-semibold tracking-tight text-foreground">{feature.title}</h3>
                      <p className="max-w-xl leading-relaxed text-muted-foreground text-sm font-normal">{feature.copy}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Data & Forecasting Section */}
        <section className="bg-background py-20 sm:py-28 border-b border-border">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-2 lg:items-center lg:px-8">
            <div className="rounded-xl border border-border bg-secondary/30 p-4 sm:p-6 shadow-xs">
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Forecast for Q3</p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight">$284,500</p>
                  </div>
                  <span className="rounded-lg bg-foreground text-background px-2.5 py-1 text-xs font-semibold">
                    +18.4%
                  </span>
                </div>
                <div className="flex h-48 items-end gap-3 border-b border-border pt-5">
                  {[38, 52, 47, 68, 61, 84, 76, 95].map((height, index) => (
                    <div
                      key={index}
                      className="flex-1 rounded-t-md bg-foreground/20 hover:bg-foreground transition-colors duration-200 cursor-pointer"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Check className="h-4 w-4 text-foreground" /> Forecast updated from live pipeline activity
                </div>
              </div>
            </div>
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Decisions, not dashboards
              </p>
              <h2 className="max-w-lg text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Know what closes next—and why.
              </h2>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground font-normal">
                See pipeline health, team activity, and revenue forecasts in one calm view. Goom turns the work already happening into answers you can act on.
              </p>
              <Button asChild variant="outline" className="mt-8 rounded-lg font-semibold shadow-xs hover:bg-secondary">
                <Link to="/auth">
                  Explore Goom <ArrowRight className="h-4 w-4 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Bottom CTA banner */}
        <section id="pricing" className="bg-foreground py-20 text-background sm:py-28">
          <div className="mx-auto max-w-4xl px-5 text-center lg:px-8">
            <div className="flex justify-center mb-7">
              <Brand size="lg" inverse />
            </div>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              A CRM your team will actually use.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-background/70 leading-relaxed font-normal text-sm sm:text-base">
              Start in minutes, keep every deal visible, and give your team more time to sell.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="h-12 rounded-lg bg-background px-8 text-foreground font-semibold hover:bg-background/90 shadow-md">
                <Link to="/auth">
                  Start for free <ArrowRight className="h-4 w-4 ml-1.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-lg border-background/20 bg-foreground text-background font-semibold hover:bg-background/10">
                <Link to="/pricing">View pricing</Link>
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
            <Link to="/auth" className="hover:text-background transition-colors">Sign in</Link>
          </div>
          <p className="text-xs text-background/40">© {new Date().getFullYear()} Goom Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}