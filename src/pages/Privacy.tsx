import { useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export default function Privacy() {
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
            Privacy & Trust
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl text-foreground">
            Privacy Policy
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Last updated: September 18, 2026
          </p>

          <div className="mt-10 space-y-8 text-xs leading-relaxed text-foreground/80 border-t border-border pt-8">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">1. Introduction</h2>
              <p>
                At Goom Inc. ("Goom," "we," "us"), we believe privacy is foundational. This Privacy Policy outlines what information we collect, how we process it, and how your data is safeguarded when you visit our website or use our application.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">2. Data We Collect</h2>
              <p>
                We collect information directly from you when you register an account, update your company profile, or connect integrations. This includes:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Account identifiers (name, work email address, hashed passwords)</li>
                <li>Workspace data (deal stages, contact records, company profiles, activity logs)</li>
                <li>Usage diagnostics and performance metrics to ensure uptime and application speed</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">3. How We Use Your Data</h2>
              <p>
                Your information is used strictly to provide, maintain, and optimize the Goom sales platform. We do NOT sell your personal or workspace data to advertisers or third-party brokers.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">4. Encryption & Security</h2>
              <p>
                All data in transit is encrypted using modern TLS 1.3 protocol. Data at rest is encrypted with AES-256 standards. Access to production systems is gated through zero-trust multi-factor authentication and continuous logging.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">5. Your GDPR and CCPA Rights</h2>
              <p>
                You have full control over your data. Depending on your jurisdiction, you have the right to access, rectify, export, or permanently delete your personal information at any time via your Settings or by contacting privacy@goom.com.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">6. Contact Us</h2>
              <p>
                If you have questions regarding this Privacy Policy, please reach out to our Data Protection Officer at privacy@goom.com.
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
