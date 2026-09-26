/**
 * Fictional example data for the interactive product tour on the marketing site.
 * Every name, company and amount here is made up and is labelled "Example data" in the UI.
 * Nothing in this file is a claim about real customers or real results.
 */
import { PLANS, PLAN_ORDER, minimumPlanFor, type PlanFeature } from "@/lib/plans";

export type StageId = "lead" | "qualified" | "proposal" | "negotiation" | "won";

export interface TourStage {
  id: StageId;
  name: string;
  /** Default win probability used for the weighted pipeline. */
  probability: number;
  /** Token-based dot color class. */
  dot: string;
}

export const TOUR_STAGES: TourStage[] = [
  { id: "lead", name: "Lead", probability: 10, dot: "bg-muted-foreground" },
  { id: "qualified", name: "Qualified", probability: 30, dot: "bg-chart-2" },
  { id: "proposal", name: "Proposal", probability: 55, dot: "bg-chart-4" },
  { id: "negotiation", name: "Negotiation", probability: 75, dot: "bg-chart-5" },
  { id: "won", name: "Won", probability: 100, dot: "bg-chart-3" },
];

export interface TourMember {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: "admin" | "manager" | "rep";
}

export const TOUR_MEMBERS: TourMember[] = [
  { id: "u1", name: "Amira Khan", initials: "AK", email: "amira@example.com", role: "admin" },
  { id: "u2", name: "Jonah Mills", initials: "JM", email: "jonah@example.com", role: "manager" },
  { id: "u3", name: "Sara Ruiz", initials: "SR", email: "sara@example.com", role: "rep" },
  { id: "u4", name: "Leo Brandt", initials: "LB", email: "leo@example.com", role: "rep" },
];

export function memberById(id: string): TourMember {
  return TOUR_MEMBERS.find((m) => m.id === id) ?? TOUR_MEMBERS[0];
}

export interface TourDeal {
  id: string;
  title: string;
  company: string;
  contact: string;
  value: number;
  stage: StageId;
  ownerId: string;
  /** Expected close date as days from today (negative = in the past). */
  closeInDays: number;
  /** Days since the last logged activity. */
  lastActivityDays: number;
}

export const INITIAL_DEALS: TourDeal[] = [
  { id: "d1", title: "Website redesign", company: "Fernhill Studio", contact: "Nina Hale", value: 8400, stage: "lead", ownerId: "u3", closeInDays: 41, lastActivityDays: 2 },
  { id: "d2", title: "Fleet tracking pilot", company: "Juniper Freight", contact: "Omar Reyes", value: 15600, stage: "lead", ownerId: "u4", closeInDays: 55, lastActivityDays: 6 },
  { id: "d3", title: "Annual support plan", company: "Ridgeway Dental", contact: "Priya Nair", value: 3200, stage: "qualified", ownerId: "u2", closeInDays: 18, lastActivityDays: 21 },
  { id: "d4", title: "Onboarding package", company: "Pine & Co.", contact: "Tom Becker", value: 5900, stage: "qualified", ownerId: "u3", closeInDays: 25, lastActivityDays: 1 },
  { id: "d5", title: "Warehouse fit-out", company: "Kestrel Logistics", contact: "Hana Sato", value: 42000, stage: "proposal", ownerId: "u3", closeInDays: -6, lastActivityDays: 9 },
  { id: "d6", title: "Lab equipment refresh", company: "Brightwater Labs", contact: "Ellis Grant", value: 23800, stage: "proposal", ownerId: "u4", closeInDays: 12, lastActivityDays: 3 },
  { id: "d7", title: "Multi-site rollout", company: "Harlow Clinics", contact: "Grace Okafor", value: 27500, stage: "negotiation", ownerId: "u2", closeInDays: 9, lastActivityDays: 0 },
  { id: "d8", title: "Campus licences", company: "Northgate Schools", contact: "Ben Carter", value: 18900, stage: "negotiation", ownerId: "u1", closeInDays: 14, lastActivityDays: 4 },
  { id: "d9", title: "Brand refresh", company: "Oakline Foods", contact: "Lucia Romano", value: 12000, stage: "won", ownerId: "u3", closeInDays: -3, lastActivityDays: 3 },
  { id: "d10", title: "Store fit-out", company: "Moss & Vale", contact: "Ivy Chen", value: 31000, stage: "won", ownerId: "u4", closeInDays: -12, lastActivityDays: 12 },
  { id: "d11", title: "Data migration", company: "Alder Finance", contact: "Marcus Lee", value: 9700, stage: "lead", ownerId: "u1", closeInDays: 60, lastActivityDays: 15 },
];

/** The deal shown in the "Deal detail" step. */
export const FEATURED_DEAL_ID = "d7";

export function stageIndex(stage: StageId): number {
  return TOUR_STAGES.findIndex((s) => s.id === stage);
}

export function stageById(stage: StageId): TourStage {
  return TOUR_STAGES[stageIndex(stage)] ?? TOUR_STAGES[0];
}

export function nextStage(stage: StageId): StageId | null {
  const i = stageIndex(stage);
  return i >= 0 && i < TOUR_STAGES.length - 1 ? TOUR_STAGES[i + 1].id : null;
}

/** Returns a new array with the deal moved to `stage` (no-op when the deal doesn't exist). */
export function moveDeal(deals: TourDeal[], dealId: string, stage: StageId): TourDeal[] {
  return deals.map((d) => (d.id === dealId ? { ...d, stage, lastActivityDays: 0 } : d));
}

export interface StageTotal {
  stage: TourStage;
  count: number;
  value: number;
}

export function stageTotals(deals: TourDeal[]): StageTotal[] {
  return TOUR_STAGES.map((stage) => {
    const inStage = deals.filter((d) => d.stage === stage.id);
    return { stage, count: inStage.length, value: inStage.reduce((s, d) => s + d.value, 0) };
  });
}

/** Sum of open deal values multiplied by their stage probability. */
export function weightedPipeline(deals: TourDeal[]): number {
  return Math.round(
    deals
      .filter((d) => d.stage !== "won")
      .reduce((sum, d) => sum + (d.value * stageById(d.stage).probability) / 100, 0),
  );
}

export interface RiskFlag {
  deal: TourDeal;
  reason: string;
}

/** Open deals that are past their close date or have gone quiet for 14+ days. */
export function atRiskDeals(deals: TourDeal[]): RiskFlag[] {
  const flags: RiskFlag[] = [];
  for (const d of deals) {
    if (d.stage === "won") continue;
    if (d.closeInDays < 0) flags.push({ deal: d, reason: `close date passed ${Math.abs(d.closeInDays)} days ago` });
    else if (d.lastActivityDays >= 14) flags.push({ deal: d, reason: `no activity for ${d.lastActivityDays} days` });
  }
  return flags;
}

export function matchesQuery(query: string, ...fields: string[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => f.toLowerCase().includes(q));
}

/* ------------------------------------------------------------------ contacts */

export interface TourContact {
  id: string;
  name: string;
  initials: string;
  email: string;
  title: string;
  company: string;
  ownerId: string;
  lastActivityDays: number;
  openDeals: number;
}

export const TOUR_CONTACTS: TourContact[] = [
  { id: "c1", name: "Grace Okafor", initials: "GO", email: "grace@harlow.example", title: "Operations director", company: "Harlow Clinics", ownerId: "u2", lastActivityDays: 0, openDeals: 1 },
  { id: "c2", name: "Hana Sato", initials: "HS", email: "hana@kestrel.example", title: "Head of facilities", company: "Kestrel Logistics", ownerId: "u3", lastActivityDays: 9, openDeals: 1 },
  { id: "c3", name: "Ben Carter", initials: "BC", email: "ben@northgate.example", title: "IT manager", company: "Northgate Schools", ownerId: "u1", lastActivityDays: 4, openDeals: 1 },
  { id: "c4", name: "Priya Nair", initials: "PN", email: "priya@ridgeway.example", title: "Practice manager", company: "Ridgeway Dental", ownerId: "u2", lastActivityDays: 21, openDeals: 1 },
  { id: "c5", name: "Ellis Grant", initials: "EG", email: "ellis@brightwater.example", title: "Lab lead", company: "Brightwater Labs", ownerId: "u4", lastActivityDays: 3, openDeals: 1 },
  { id: "c6", name: "Lucia Romano", initials: "LR", email: "lucia@oakline.example", title: "Marketing lead", company: "Oakline Foods", ownerId: "u3", lastActivityDays: 3, openDeals: 0 },
  { id: "c7", name: "Marcus Lee", initials: "ML", email: "marcus@alder.example", title: "CFO", company: "Alder Finance", ownerId: "u1", lastActivityDays: 15, openDeals: 1 },
  { id: "c8", name: "Dev Patel", initials: "DP", email: "dev@harlow.example", title: "Procurement", company: "Harlow Clinics", ownerId: "u2", lastActivityDays: 34, openDeals: 0 },
];

/* --------------------------------------------------------------------- tasks */

export interface TourTask {
  id: string;
  title: string;
  dealTitle?: string;
  dueInDays: number;
  priority: "high" | "medium" | "low";
  done: boolean;
}

export const INITIAL_TASKS: TourTask[] = [
  { id: "t1", title: "Send revised quote", dealTitle: "Warehouse fit-out", dueInDays: -2, priority: "high", done: false },
  { id: "t2", title: "Confirm site visit dates", dealTitle: "Multi-site rollout", dueInDays: 0, priority: "high", done: false },
  { id: "t3", title: "Call Priya about renewal", dealTitle: "Annual support plan", dueInDays: 0, priority: "medium", done: false },
  { id: "t4", title: "Share case study", dealTitle: "Lab equipment refresh", dueInDays: 2, priority: "low", done: false },
  { id: "t5", title: "Prepare contract draft", dealTitle: "Campus licences", dueInDays: 5, priority: "medium", done: false },
  { id: "t6", title: "Kick-off agenda", dealTitle: "Brand refresh", dueInDays: 8, priority: "low", done: false },
];

/* ------------------------------------------------------------------ forecast */

export type ForecastHorizon = 3 | 6;

/**
 * Monthly example forecast (index 0 = this month). Commit = open deals at 70%+ probability,
 * best case = 40-69%, pipeline = everything else that is open — the same categories the app uses.
 */
export const FORECAST_MONTHS = [
  { commit: 46400, bestCase: 23800, pipeline: 8400 },
  { commit: 18900, bestCase: 42000, pipeline: 15600 },
  { commit: 12500, bestCase: 16200, pipeline: 21400 },
  { commit: 8000, bestCase: 22500, pipeline: 9700 },
  { commit: 0, bestCase: 14800, pipeline: 26000 },
  { commit: 0, bestCase: 9600, pipeline: 18200 },
];

export const FORECAST_MONTHLY_QUOTA = 40000;

export function forecastSeries(horizon: ForecastHorizon, now = new Date()) {
  return FORECAST_MONTHS.slice(0, horizon).map((m, i) => ({
    month: new Date(now.getFullYear(), now.getMonth() + i, 1).toLocaleString("en-US", { month: "short" }),
    ...m,
  }));
}

/* ------------------------------------------------------------------- reports */

export type ReportPeriod = "this" | "last";

export const REPORTS: Record<
  ReportPeriod,
  {
    winRate: number;
    avgDeal: number;
    cycleDays: number;
    trend: number[];
    funnel: number[];
    leaderboard: { memberId: string; won: number }[];
    lostReasons: { reason: string; count: number }[];
  }
> = {
  this: {
    winRate: 0.34,
    avgDeal: 17800,
    cycleDays: 31,
    trend: [0.24, 0.27, 0.26, 0.3, 0.31, 0.34],
    funnel: [42, 29, 18, 11, 8],
    leaderboard: [
      { memberId: "u4", won: 31000 },
      { memberId: "u3", won: 12000 },
      { memberId: "u2", won: 8600 },
      { memberId: "u1", won: 4100 },
    ],
    lostReasons: [
      { reason: "Price", count: 4 },
      { reason: "Timing", count: 3 },
      { reason: "Chose competitor", count: 2 },
      { reason: "No decision", count: 1 },
    ],
  },
  last: {
    winRate: 0.28,
    avgDeal: 15200,
    cycleDays: 36,
    trend: [0.22, 0.25, 0.23, 0.27, 0.26, 0.28],
    funnel: [38, 24, 15, 9, 6],
    leaderboard: [
      { memberId: "u3", won: 24500 },
      { memberId: "u2", won: 19000 },
      { memberId: "u4", won: 9800 },
      { memberId: "u1", won: 0 },
    ],
    lostReasons: [
      { reason: "Timing", count: 5 },
      { reason: "Price", count: 3 },
      { reason: "No decision", count: 3 },
      { reason: "Chose competitor", count: 1 },
    ],
  },
};

export function monthLabels(count: number, now = new Date()): string[] {
  return Array.from({ length: count }, (_, i) =>
    new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1).toLocaleString("en-US", { month: "short" }),
  );
}

/* ------------------------------------------------------------------ helpers */

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function formatCompactMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function relativeDays(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `In ${days} days` : `${Math.abs(days)} days ago`;
}

export function dateFromToday(days: number, now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
}

export function shortDate(days: number, now = new Date()): string {
  return dateFromToday(days, now).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Growth & Enterprise" style label for a plan-gated feature, from the plan catalog. */
export function plansWithFeature(feature: PlanFeature): string {
  const from = PLAN_ORDER.indexOf(minimumPlanFor(feature).id);
  return PLAN_ORDER.slice(from)
    .map((id) => PLANS[id].name)
    .join(" & ");
}

