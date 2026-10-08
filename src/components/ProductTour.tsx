import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { modKeyLabel } from "@/hooks/useHotkeys";

/**
 * A short, skippable spotlight tour of the app shell. Steps anchor to `data-tour="…"` attributes
 * on shell elements; steps whose anchor isn't visible (e.g. the sidebar on phones) are skipped.
 * Shown once per user (localStorage) and restartable from the user menu.
 */

interface TourStep {
  /** `data-tour` value of the element to highlight; omit for a centered intro card. */
  anchor?: string;
  title: string;
  body: string;
}

const buildSteps = (): TourStep[] => [
  {
    title: "Welcome to Goom",
    body: "A 30-second look at where things live. You can skip at any time and restart the tour from your user menu.",
  },
  {
    anchor: "sidebar-nav",
    title: "Your workspace",
    body: "Pipeline, contacts, companies, tasks and reports are all one click away. Press G then a letter to jump — G P opens the pipeline.",
  },
  {
    anchor: "command-palette",
    title: "Search and quick actions",
    body: `Press ${modKeyLabel("k")} to find any deal, contact or company, create a record, or jump to a page.`,
  },
  {
    anchor: "notifications",
    title: "Notifications",
    body: "Deals assigned to you, deals won or lost, and tasks teammates assign you land here. Click one to open the record.",
  },
  {
    anchor: "user-menu",
    title: "Your account",
    body: "Profile and workspace settings, theme, keyboard shortcuts and sign out.",
  },
];

const storageKey = (userId: string) => `goom:tour-completed:${userId}`;

function hasCompletedTour(userId: string): boolean {
  try {
    return localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return true; // storage blocked: don't nag on every load
  }
}

function markTourCompleted(userId: string) {
  try {
    localStorage.setItem(storageKey(userId), "1");
  } catch {
    /* ignore */
  }
}

function findAnchor(anchor: string): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${anchor}"]`));
  return (
    nodes.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
    }) ?? null
  );
}

const PAD = 6;
const CARD_W = 320;
const GAP = 12;

interface Layout {
  hole: { top: number; left: number; width: number; height: number } | null;
  card: { top: number; left: number };
}

function computeLayout(el: HTMLElement | null, cardH: number): Layout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(CARD_W, vw - 32);
  if (!el) return { hole: null, card: { top: Math.max(16, (vh - cardH) / 2), left: (vw - cardW) / 2 } };

  const r = el.getBoundingClientRect();
  const top = Math.max(r.top, 8);
  const bottom = Math.min(r.bottom, vh - 8);
  const hole = { top: top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: bottom - top + PAD * 2 };
  const clampX = (x: number) => Math.min(Math.max(16, x), vw - cardW - 16);
  const clampY = (y: number) => Math.min(Math.max(16, y), vh - cardH - 16);

  // Tall element on the left (sidebar): place the card to its right.
  if (r.left < vw / 3 && r.right + GAP + cardW + 16 <= vw && r.height > vh / 3) {
    return { hole, card: { top: clampY(top + 24), left: r.right + PAD + GAP } };
  }
  // Below if it fits, else above.
  const left = clampX(r.left + r.width / 2 - cardW / 2);
  if (bottom + PAD + GAP + cardH <= vh - 16) return { hole, card: { top: bottom + PAD + GAP, left } };
  return { hole, card: { top: clampY(top - PAD - GAP - cardH), left } };
}

interface ProductTourProps {
  /** Auto-start for users who haven't seen the tour (set false while onboarding is showing). */
  enabled?: boolean;
  /** Increment to (re)start the tour on demand, e.g. from the user menu. */
  startSignal?: number;
}

export function ProductTour({ enabled = false, startSignal = 0 }: ProductTourProps) {
  const { user } = useAuth();
  const userId = user?.id;
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<Layout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const lastSignal = useRef(startSignal);

  const start = useCallback(() => {
    const available = buildSteps().filter((s) => !s.anchor || findAnchor(s.anchor));
    setIndex(0);
    setSteps(available);
  }, []);

  const finish = useCallback(() => {
    if (userId) markTourCompleted(userId);
    setSteps(null);
    setLayout(null);
  }, [userId]);

  // First visit: start once the shell has rendered.
  useEffect(() => {
    if (!enabled || !userId || hasCompletedTour(userId)) return;
    const t = window.setTimeout(start, 900);
    return () => window.clearTimeout(t);
  }, [enabled, userId, start]);

  // Manual restart.
  useEffect(() => {
    if (startSignal !== lastSignal.current) {
      lastSignal.current = startSignal;
      if (startSignal > 0) start();
    }
  }, [startSignal, start]);

  const step = steps?.[index];

  // Position the spotlight + card; follow resizes and scrolls.
  useLayoutEffect(() => {
    if (!step) return;
    let frame = 0;
    const el = step.anchor ? findAnchor(step.anchor) : null;
    if (el) el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setLayout(computeLayout(el, cardRef.current?.offsetHeight ?? 180)));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step]);

  // Re-measure once the card has its real height.
  useLayoutEffect(() => {
    if (!step || !cardRef.current) return;
    const el = step.anchor ? findAnchor(step.anchor) : null;
    setLayout(computeLayout(el, cardRef.current.offsetHeight));
  }, [step, index]);

  useEffect(() => {
    if (step) primaryRef.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    if (!steps) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (e.key === "ArrowRight") {
        setIndex((i) => Math.min(i + 1, steps.length - 1));
      } else if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(i - 1, 0));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [steps, finish]);

  if (!steps || !step) return null;
  const isLast = index === steps.length - 1;
  const hole = layout?.hole;

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="presentation">
      {/* Dim layer with a cut-out around the anchor (box-shadow trick); click outside does nothing. */}
      {hole ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-lg ring-2 ring-background/80 transition-all duration-200 ease-out"
          style={{ ...hole, boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.5)" }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-black/50" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-tour-title"
        aria-describedby="product-tour-body"
        className="absolute w-[min(20rem,calc(100vw-2rem))] rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl transition-[top,left] duration-200 ease-out"
        style={{ top: layout?.card.top ?? -9999, left: layout?.card.left ?? -9999 }}
      >
        <p className="text-xs font-medium text-muted-foreground tabular-nums">
          {index + 1} of {steps.length}
        </p>
        <h2 id="product-tour-title" className="mt-1 text-sm font-semibold">
          {step.title}
        </h2>
        <p id="product-tour-body" className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={finish} className="-ml-2 text-muted-foreground">
            {isLast ? "Close" : "Skip tour"}
          </Button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button variant="outline" size="sm" onClick={() => setIndex((i) => i - 1)}>
                Back
              </Button>
            )}
            <Button ref={primaryRef} size="sm" onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}>
              {isLast ? "Done" : index === 0 ? "Show me" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default ProductTour;
