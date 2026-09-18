import { useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export default function Terms() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      <main className="flex-1 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-5 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Legal
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl text-foreground">
            Terms of Service
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Last updated: September 18, 2026
          </p>

          <div className="mt-10 space-y-8 text-xs leading-relaxed text-foreground/80 border-t border-border pt-8">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">1. Agreement to Terms</h2>
              <p>
                By accessing or using Goom ("the Service"), operated by Goom Inc. ("we," "us," or "our"), you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the Service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">2. Account Registration & Security</h2>
              <p>
                When you create an account with us, you must provide accurate, complete, and current information. You are responsible for safeguarding the credentials you use to access the Service and for any activities or actions under your account.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">3. Customer Data & Confidentiality</h2>
              <p>
                You retain all rights and ownership in your data submitted to Goom ("Customer Data"). We do not sell, rent, or lease your Customer Data to third parties. We maintain industry-standard physical and electronic safeguards to protect Customer Data against unauthorized access.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">4. Subscription Terms & Cancellations</h2>
              <p>
                Paid accounts are billed on a subscription basis (monthly or annually). You may cancel your subscription at any time via your account settings. Upon cancellation, your access will continue until the end of your current paid billing period.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">5. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by applicable law, Goom Inc. shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your access to or use of the Service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">6. Contact Information</h2>
              <p>
                Questions regarding these Terms should be sent to legal@goom.com.
              </p>
            </section>
          </div>
        </div>
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
