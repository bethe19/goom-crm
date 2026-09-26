import { Suspense, lazy, useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  BarChart3,
  CheckSquare,
  FileText,
  KanbanSquare,
  LineChart,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  UsersRound,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { cn } from "@/lib/utils";
import { FEATURED_DEAL_ID, INITIAL_DEALS, moveDeal, type StageId, type TourDeal } from "./tour/data";
import { useInView, useReducedMotion } from "./tour/hooks";
import { PipelineScene } from "./tour/PipelineScene";
import { DealScene } from "./tour/DealScene";
import { ContactsScene } from "./tour/ContactsScene";
import { TasksScene } from "./tour/TasksScene";
import { CommandScene, type TourNavTarget } from "./tour/CommandScene";
import { AssistantScene } from "./tour/AssistantScene";
import { TeamScene } from "./tour/TeamScene";

// The chart scenes pull in recharts; load them on demand (and prefetch once the tour is on screen).
const loadForecast = () => import("./tour/ForecastScene");
const loadReports = () => import("./tour/ReportsScene");
const ForecastScene = lazy(() => loadForecast().then((m) => ({ default: m.ForecastScene })));
const ReportsScene = lazy(() => loadReports().then((m) => ({ default: m.ReportsScene })));

type StepId = "pipeline" | "deal" | "contacts" | "tasks" | "forecast" | "reports" | "command" | "assistant" | "team";

interface Step {
  id: StepId;
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
  path: string;
  /** Autoplay duration in ms. */
  duration: number;
}

const STEPS: Step[] = [
  {
    id: "pipeline",
    label: "Pipeline",
    icon: KanbanSquare,
    title: "Drag deals through your stages",
    description: "Stage counts, totals and the weighted pipeline update as deals move. Try dragging a card.",
    path: "/pipeline",
    duration: 8000,
  },
  {
    id: "deal",
    label: "Deals",
    icon: FileText,
    title: "Everything about a deal in one place",
    description: "Stage, owner, people, an activity timeline and the full change history.",
    path: "/pipeline?open=deal",
    duration: 9000,
  },
  {
    id: "contacts",
    label: "Contacts",
    icon: UsersRound,
    title: "People and companies, shared by the team",
    description: "Search and filter, select rows for bulk actions, and open anyone's details.",
    path: "/contacts",
    duration: 8000,
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: CheckSquare,
    title: "Never lose a next step",
    description: "See what's overdue, tick tasks off, and spot busy days on the calendar.",
    path: "/tasks",
    duration: 7000,
  },
  {
    id: "forecast",
    label: "Forecast",
    icon: LineChart,
    title: "Know what's likely to close",
    description: "Commit and best case by month from your open deals, against your quota.",
    path: "/forecast",
    duration: 8000,
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    title: "See what's working",
    description: "Win rate, stage conversion, a team leaderboard and lost reasons for any period.",
    path: "/reports",
    duration: 7000,
  },
  {
    id: "command",
    label: "Search",
    icon: Search,
    title: "Jump anywhere from the keyboard",
    description: "Press Ctrl K (⌘K on Mac) to find any deal, person or page. Try typing below.",
    path: "/dashboard",
    duration: 7000,
  },
  {
    id: "assistant",
    label: "Assistant",
    icon: Sparkles,
    title: "Ask your pipeline a question",
    description: "Get summaries, at-risk deals and follow-up drafts based on your own records.",
    path: "/dashboard",
    duration: 8000,
  },
  {
    id: "team",
    label: "Team",
    icon: UserCog,
    title: "The right access for every role",
    description: "Invite teammates as admin, manager or rep. Reps see the deals they own or created.",
    path: "/settings?tab=team",
    duration: 8000,
  },
];

const SIDEBAR: { label: string; icon: LucideIcon; step: StepId; also?: StepId[] }[] = [
  { label: "Pipeline", icon: KanbanSquare, step: "pipeline", also: ["deal"] },
  { label: "Contacts", icon: UsersRound, step: "contacts" },
  { label: "Tasks", icon: CheckSquare, step: "tasks" },
  { label: "Forecast", icon: LineChart, step: "forecast" },
  { label: "Reports", icon: BarChart3, step: "reports" },
  { label: "Assistant", icon: Sparkles, step: "assistant" },
  { label: "Team", icon: UserCog, step: "team" },
];

const KEYFRAMES = `@keyframes goom-tour-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }`;

function SceneFallback() {
  return (
    <div className="space-y-3 p-5" aria-hidden="true">
      <div className="h-4 w-32 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-secondary motion-reduce:animate-none" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-lg bg-secondary motion-reduce:animate-none" />
    </div>
  );
}

/**
 * Interactive, self-contained product tour for the marketing site. Every record shown is
 * fictional example data (labelled in the UI); nothing is read from or written to a backend.
 */
export function InteractiveProductTour({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion();
  const [rootRef, inView] = useInView<HTMLDivElement>();
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(!reducedMotion);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [deals, setDeals] = useState<TourDeal[]>(INITIAL_DEALS);
  const [resetKey, setResetKey] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabList = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion) setAutoplay(false);
  }, [reducedMotion]);

  // Prefetch the chart scenes once the tour is visible.
  useEffect(() => {
    if (!inView) return;
    const t = window.setTimeout(() => {
      void loadForecast();
      void loadReports();
    }, 1500);
    return () => window.clearTimeout(t);
  }, [inView]);

  const step = STEPS[index];
  const running = autoplay && !hovering && !focused && inView;
  const animate = !reducedMotion;

  // Keep the active tab visible inside the (horizontally scrollable) tab row without scrolling the page.
  useEffect(() => {
    const list = tabList.current;
    const tab = tabRefs.current[index];
    if (!list || !tab) return;
    const left = tab.offsetLeft - list.clientWidth / 2 + tab.clientWidth / 2;
    list.scrollTo({ left: Math.max(0, left), behavior: reducedMotion ? "auto" : "smooth" });
  }, [index, reducedMotion]);

  const select = useCallback((i: number, focus = false) => {
    const next = (i + STEPS.length) % STEPS.length;
    setIndex(next);
    setAutoplay(false);
    if (focus) tabRefs.current[next]?.focus();
  }, []);

  const goTo = useCallback((id: StepId) => select(STEPS.findIndex((s) => s.id === id)), [select]);

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const at = Math.max(0, tabRefs.current.indexOf(e.currentTarget));
    const keys: Record<string, number> = {
      ArrowRight: at + 1,
      ArrowDown: at + 1,
      ArrowLeft: at - 1,
      ArrowUp: at - 1,
      Home: 0,
      End: STEPS.length - 1,
    };
    if (e.key in keys) {
      e.preventDefault();
      select(keys[e.key], true);
    }
  };

  const onMove = useCallback((dealId: string, stage: StageId) => setDeals((d) => moveDeal(d, dealId, stage)), []);
  const onAdd = useCallback((deal: TourDeal) => setDeals((d) => [deal, ...d]), []);
  const reset = () => {
    setDeals(INITIAL_DEALS);
    setResetKey((k) => k + 1);
  };

  const featured = deals.find((d) => d.id === FEATURED_DEAL_ID) ?? INITIAL_DEALS[0];
  const sceneProps = { demo: running, animate };

  const scene = (() => {
    switch (step.id) {
      case "pipeline":
        return <PipelineScene deals={deals} onMove={onMove} onAdd={onAdd} {...sceneProps} />;
      case "deal":
        return <DealScene deal={featured} onMove={onMove} {...sceneProps} />;
      case "contacts":
        return <ContactsScene {...sceneProps} />;
      case "tasks":
        return <TasksScene deals={deals} {...sceneProps} />;
      case "forecast":
        return <ForecastScene deals={deals} {...sceneProps} />;
      case "reports":
        return <ReportsScene {...sceneProps} />;
      case "command":
        return (
          <CommandScene
            deals={deals}
            featuredDealId={FEATURED_DEAL_ID}
            onNavigate={(t: TourNavTarget) => goTo(t)}
            {...sceneProps}
          />
        );
      case "assistant":
        return <AssistantScene deals={deals} {...sceneProps} />;
      case "team":
        return <TeamScene deals={deals} {...sceneProps} />;
    }
  })();

  return (
    <div
      ref={rootRef}
      className={cn("w-full text-left", className)}
    >
      <style>{KEYFRAMES}</style>

      {/* Step tabs */}
      <div className="flex items-center gap-2">
        <div
          ref={tabList}
          role="tablist"
          aria-label="Product tour"
          className="flex min-w-0 flex-1 snap-x gap-1 overflow-x-auto rounded-xl border border-border bg-secondary/50 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {STEPS.map((s, i) => {
            const active = i === index;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                ref={(el) => (tabRefs.current[i] = el)}
                id={`tour-tab-${s.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="tour-panel"
                tabIndex={active ? 0 : -1}
                onClick={() => select(i)}
                onKeyDown={onTabKeyDown}
                className={cn(
                  "relative flex shrink-0 snap-start items-center gap-1.5 overflow-hidden rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex-1 lg:justify-center lg:px-2",
                  active ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap">{s.label}</span>
                {active && autoplay && (
                  <span
                    key={`${index}-${resetKey}`}
                    aria-hidden="true"
                    onAnimationEnd={() => setIndex((i2) => (i2 + 1) % STEPS.length)}
                    className="absolute inset-x-2 bottom-0.5 h-0.5 origin-left rounded-full bg-foreground/70"
                    style={{
                      animation: `goom-tour-progress ${s.duration}ms linear forwards`,
                      animationPlayState: running ? "running" : "paused",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setAutoplay((a) => !a)}
          aria-pressed={autoplay}
          aria-label={autoplay ? "Pause the tour" : "Play the tour automatically"}
          title={autoplay ? "Pause" : "Play"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {autoplay ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
      </div>

      {/* Caption */}
      <div className="mt-4 flex flex-col gap-1 px-1 sm:flex-row sm:items-baseline sm:gap-3">
        <h3 className="text-base font-semibold tracking-tight">{step.title}</h3>
        <p className="text-sm text-muted-foreground">{step.description}</p>
      </div>

      {/* App window */}
      <div
        onPointerEnter={(e) => e.pointerType === "mouse" && setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
        }}
        className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_16px_48px_-16px_hsl(var(--foreground)/0.18)]">
        <div className="flex h-10 items-center gap-3 border-b border-border bg-secondary/50 px-3 sm:px-4">
          <div className="flex shrink-0 gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
          </div>
          <span className="hidden min-w-0 truncate rounded-md border border-border bg-background px-3 py-0.5 font-mono text-[11px] text-muted-foreground sm:block">
            {step.path}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" /> Reset
            </button>
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Example data
            </span>
          </span>
        </div>

        <div className="flex h-[560px] sm:h-[540px] lg:h-[580px]">
          <aside className="hidden w-48 shrink-0 flex-col border-r border-border bg-secondary/30 p-3 lg:flex" aria-hidden="true">
            <Brand size="sm" />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => goTo("command")}
              className={cn(
                "mt-4 flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground",
                step.id === "command" && "ring-1 ring-foreground/40",
              )}
            >
              <Search className="h-3.5 w-3.5" /> Search
              <kbd className="ml-auto rounded border border-border px-1 font-sans">Ctrl K</kbd>
            </button>
            <ul className="mt-3 space-y-0.5">
              {SIDEBAR.map(({ label, icon: Icon, step: target, also }) => {
                const active = step.id === target || also?.includes(step.id);
                return (
                  <li key={label}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => goTo(target)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors duration-150",
                        active ? "bg-background font-medium text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                AK
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">Amira Khan</p>
                <p className="truncate text-[11px] text-muted-foreground">Example workspace</p>
              </div>
            </div>
          </aside>

          <div
            id="tour-panel"
            role="tabpanel"
            aria-labelledby={`tour-tab-${step.id}`}
            className="min-w-0 flex-1 bg-background"
            onPointerDown={() => setAutoplay(false)}
            onKeyDown={() => setAutoplay(false)}
          >
            <div
              key={`${step.id}-${resetKey}`}
              className={cn("h-full", animate && "animate-in fade-in-0 duration-200")}
            >
              <Suspense fallback={<SceneFallback />}>{scene}</Suspense>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        An interactive preview with fictional example data. Nothing you do here is saved.
      </p>
    </div>
  );
}
