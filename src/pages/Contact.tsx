import { useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Menu, X, Mail, MapPin, CheckCircle2, MessageSquare } from "lucide-react";

export default function Contact() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    teamSize: "1-10",
    message: "",
  });
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      toast({
        title: "Please complete all required fields",
        description: "Name, email, and message are required.",
        variant: "destructive",
      });
      return;
    }

    setSubmitted(true);
    toast({
      title: "Message received",
      description: "Thanks for reaching out! Our sales team will get back to you within 4 business hours.",
    });
  };

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
              <Link to="/contact" className="py-1 text-foreground font-semibold" onClick={() => setMobileMenuOpen(false)}>Contact</Link>
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
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-16 items-start">
            {/* Left side info */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Get in touch
              </p>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl text-foreground">
                Let's talk about your sales workflow.
              </h1>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                Whether you have questions about our enterprise security, need custom team onboarding, or want a personalized product walkthrough, we're here to help.
              </p>

              <div className="mt-10 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-lg bg-secondary/80 flex items-center justify-center text-foreground shrink-0 mt-0.5">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Email directly</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Sales: sales@goom.com</p>
                    <p className="text-xs text-muted-foreground">Support: support@goom.com</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-lg bg-secondary/80 flex items-center justify-center text-foreground shrink-0 mt-0.5">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Offices</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">San Francisco, CA & Remote Global</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-lg bg-secondary/80 flex items-center justify-center text-foreground shrink-0 mt-0.5">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Response speed</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Average response within 4 hours during business days.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side form */}
            <div className="rounded-2xl border border-border bg-card p-8 sm:p-10 shadow-xs">
              {submitted ? (
                <div className="text-center py-12">
                  <div className="h-12 w-12 rounded-full bg-foreground text-background flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">Message received!</h3>
                  <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto">
                    Thanks for reaching out, {formData.name}. A sales engineer will follow up with your team shortly.
                  </p>
                  <Button
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({ name: "", email: "", company: "", teamSize: "1-10", message: "" });
                    }}
                    variant="outline"
                    size="sm"
                    className="mt-6"
                  >
                    Send another message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs font-semibold text-foreground">
                        Your Name *
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Jane Doe"
                        required
                        className="rounded-lg border-border text-xs h-10 shadow-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                        Work Email *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="jane@company.com"
                        required
                        className="rounded-lg border-border text-xs h-10 shadow-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="company" className="text-xs font-semibold text-foreground">
                        Company Name
                      </Label>
                      <Input
                        id="company"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder="Acme Corp"
                        className="rounded-lg border-border text-xs h-10 shadow-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="teamSize" className="text-xs font-semibold text-foreground">
                        Sales Team Size
                      </Label>
                      <select
                        id="teamSize"
                        value={formData.teamSize}
                        onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })}
                        className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-foreground"
                      >
                        <option value="1-5">1 - 5 reps</option>
                        <option value="6-20">6 - 20 reps</option>
                        <option value="21-50">21 - 50 reps</option>
                        <option value="50+">50+ reps</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="message" className="text-xs font-semibold text-foreground">
                      How can we help? *
                    </Label>
                    <Textarea
                      id="message"
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Tell us about your sales process, current tools, and what you're looking to achieve..."
                      required
                      className="rounded-lg border-border text-xs shadow-xs"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-10 rounded-lg bg-foreground text-background font-medium hover:bg-foreground/90 shadow-sm mt-2"
                  >
                    Submit request <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>

                  <p className="text-[11px] text-muted-foreground text-center">
                    We respect your privacy and never share your information.
                  </p>
                </form>
              )}
            </div>
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
