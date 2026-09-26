import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LOGIN_PATH, NAV_LINKS, SIGNUP_PATH, SITE } from "./site";

function MarketingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6" aria-label="Main">
        <Link to="/" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Goom home">
          <Brand size="md" />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to={LOGIN_PATH}>Log in</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to={SIGNUP_PATH}>Get started</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="marketing-mobile-menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </nav>

      {menuOpen && (
        <div id="marketing-mobile-menu" className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden">
          <ul className="flex flex-col">
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  className={({ isActive }) =>
                    cn(
                      "block rounded-md px-2 py-2.5 text-sm font-medium",
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )
                  }
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
            <Button asChild variant="outline">
              <Link to={LOGIN_PATH}>Log in</Link>
            </Button>
            <Button asChild>
              <Link to={SIGNUP_PATH}>Get started</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

function MarketingFooter() {
  const groups = [
    {
      title: "Product",
      links: [
        { to: "/product", label: "Overview" },
        { to: "/solutions", label: "Solutions" },
        { to: "/customers", label: "Use cases" },
        { to: "/pricing", label: "Pricing" },
      ],
    },
    {
      title: "Company",
      links: [
        { to: "/contact", label: "Contact" },
        { to: "/privacy", label: "Privacy" },
        { to: "/terms", label: "Terms" },
      ],
    },
    {
      title: "Account",
      links: [
        { to: LOGIN_PATH, label: "Log in" },
        { to: SIGNUP_PATH, label: "Create a workspace" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Brand size="sm" />
          <p className="max-w-xs text-sm text-muted-foreground">A calm, focused CRM for small sales teams.</p>
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</h2>
            <ul className="mt-3 space-y-2">
              {g.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-foreground/80 transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} {SITE.legalEntity}
        </p>
      </div>
    </footer>
  );
}

/** Shared shell for all public pages: forced light theme, header, footer, document title. */
export function MarketingLayout({ title, children }: { title?: string; children: ReactNode }) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · ${SITE.name}` : `${SITE.name} — CRM for small sales teams`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="force-light flex min-h-screen flex-col overflow-x-clip bg-background text-foreground antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-sm focus:text-background"
      >
        Skip to content
      </a>
      <MarketingHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-12 pt-16 text-center sm:px-6 sm:pt-24">
      {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{eyebrow}</p>}
      <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      {description && <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>}
      {children && <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">{children}</div>}
    </section>
  );
}

export function CtaBand({
  title = "Set up your workspace in a few minutes.",
  description = "Create a workspace, import a CSV or load sample data, and invite your team when you're ready.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="border-t border-border bg-foreground text-background">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-background/70 sm:text-base">{description}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-background text-foreground hover:bg-background/90">
            <Link to={SIGNUP_PATH}>
              Get started <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-background/25 bg-transparent text-background hover:bg-background/10 hover:text-background"
          >
            <Link to="/pricing">View pricing</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Layout for Terms / Privacy: readable measure, numbered sections. */
export function LegalPage({
  title,
  eyebrow,
  sections,
}: {
  title: string;
  eyebrow: string;
  sections: { heading: string; body: ReactNode }[];
}) {
  return (
    <MarketingLayout title={title}>
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {SITE.legalLastUpdated}</p>
        <div className="mt-10 space-y-8 border-t border-border pt-8 text-sm leading-relaxed text-foreground/85">
          {sections.map((s, i) => (
            <section key={s.heading} className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                {i + 1}. {s.heading}
              </h2>
              {s.body}
            </section>
          ))}
        </div>
      </article>
    </MarketingLayout>
  );
}
