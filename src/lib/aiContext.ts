/**
 * Builds a compact, factual summary of the current workspace for the AI assistant.
 * Everything here is derived from real rows (RLS scopes every select to the current workspace).
 */
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";

export interface CtxStage {
  id: string;
  name: string;
  pipeline_id: string;
  position: number;
  is_won?: boolean | null;
  is_lost?: boolean | null;
}

export interface CtxDeal {
  id: string;
  title: string;
  value: number | null;
  probability: number | null;
  close_date: string | null;
  stage_id: string;
  pipeline_id: string;
  notes: string | null;
  updated_at: string;
  companies?: { name: string } | null;
  contacts?: { first_name: string; last_name: string | null } | null;
}

export interface CtxTask {
  id: string;
  title: string;
  due_date: string | null;
  priority: string | null;
  completed: boolean;
}

export interface CtxActivity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  created_at: string;
}

export interface WorkspaceSnapshot {
  pipelines: { id: string; name: string }[];
  stages: CtxStage[];
  deals: CtxDeal[];
  /** Total number of deals in the workspace (may exceed deals.length). */
  dealCount: number;
  tasks: CtxTask[];
  activities: CtxActivity[];
}

export interface DealSignal {
  id: string;
  title: string;
  reason: string;
}

export interface WorkspaceSummary {
  text: string;
  openDealCount: number;
  openValue: number;
  atRisk: DealSignal[];
  /** A good candidate for "draft a follow-up email" suggestions. */
  followUpDeal: { id: string; title: string } | null;
  overdueTaskCount: number;
  isEmpty: boolean;
}

const DEAL_LIMIT = 200;
const MAX_LISTED_DEALS = 25;
const STALE_DAYS = 14;
const MAX_CHARS = 9_000;

const DAY = 86_400_000;

/** Days from `today` to the date (negative = in the past). Dates are compared at local midnight. */
export function daysUntil(date: string, today: Date): number {
  const d = new Date(date.length <= 10 ? `${date}T00:00:00` : date);
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((b - a) / DAY);
}

function relDays(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

function clip(text: string | null | undefined, max: number): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function isWonStage(s: CtxStage | undefined): boolean {
  if (!s) return false;
  if (typeof s.is_won === "boolean") return s.is_won;
  return /\bwon\b/i.test(s.name);
}

export function isLostStage(s: CtxStage | undefined): boolean {
  if (!s) return false;
  if (typeof s.is_lost === "boolean") return s.is_lost;
  return /\blost\b/i.test(s.name);
}

export function toIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Pure: turns a snapshot into prompt text plus a few structured signals for the UI. */
export function summarizeWorkspace(snap: WorkspaceSnapshot, currency: string, today: Date): WorkspaceSummary {
  const money = (v: number | null | undefined) => formatCurrency(Number(v ?? 0), currency);
  const stageById = new Map(snap.stages.map((s) => [s.id, s]));
  const pipelineName = new Map(snap.pipelines.map((p) => [p.id, p.name]));

  const open = snap.deals.filter((d) => {
    const s = stageById.get(d.stage_id);
    return !isWonStage(s) && !isLostStage(s);
  });
  const won = snap.deals.filter((d) => isWonStage(stageById.get(d.stage_id)));
  const lost = snap.deals.filter((d) => isLostStage(stageById.get(d.stage_id)));
  const openValue = open.reduce((sum, d) => sum + Number(d.value ?? 0), 0);

  const lines: string[] = [];

  // Pipeline by stage
  if (snap.pipelines.length === 0) {
    lines.push("No pipelines exist yet.");
  }
  for (const p of snap.pipelines) {
    const stages = snap.stages.filter((s) => s.pipeline_id === p.id).sort((a, b) => a.position - b.position);
    const parts = stages.map((s) => {
      const ds = snap.deals.filter((d) => d.stage_id === s.id);
      const v = ds.reduce((sum, d) => sum + Number(d.value ?? 0), 0);
      const tag = isWonStage(s) ? " [won]" : isLostStage(s) ? " [lost]" : "";
      return `${s.name}${tag}: ${ds.length} (${money(v)})`;
    });
    lines.push(`Pipeline "${p.name}" by stage — ${parts.length ? parts.join("; ") : "no stages"}`);
  }

  const truncatedNote =
    snap.dealCount > snap.deals.length ? ` (only the ${snap.deals.length} largest of ${snap.dealCount} deals were loaded)` : "";
  lines.push(
    `Totals${truncatedNote}: ${open.length} open deals worth ${money(openValue)}; ${won.length} won (${money(
      won.reduce((s, d) => s + Number(d.value ?? 0), 0),
    )}); ${lost.length} lost.`,
  );

  // Open deals list
  const atRisk: DealSignal[] = [];
  if (open.length > 0) {
    const listed = [...open].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0)).slice(0, MAX_LISTED_DEALS);
    lines.push("");
    lines.push(`OPEN DEALS (largest ${listed.length} of ${open.length}):`);
    for (const d of listed) {
      const stage = stageById.get(d.stage_id)?.name ?? "Unknown stage";
      const bits = [`"${clip(d.title, 80)}"`, money(d.value), `stage ${stage}`];
      if (snap.pipelines.length > 1) bits.push(`pipeline ${pipelineName.get(d.pipeline_id) ?? "?"}`);
      if (d.companies?.name) bits.push(`company ${clip(d.companies.name, 60)}`);
      if (d.contacts) bits.push(`contact ${clip(`${d.contacts.first_name} ${d.contacts.last_name ?? ""}`, 60)}`);
      if (d.close_date) bits.push(`close ${d.close_date} (${relDays(daysUntil(d.close_date, today))})`);
      else bits.push("no close date");
      bits.push(`updated ${relDays(daysUntil(d.updated_at, today))}`);
      if (d.probability != null) bits.push(`probability ${d.probability}%`);
      if (d.notes) bits.push(`notes: ${clip(d.notes, 140)}`);
      lines.push(`- ${bits.join(" | ")}`);
    }

    // Risk signals (computed, not guessed)
    for (const d of open) {
      const reasons: string[] = [];
      if (d.close_date && daysUntil(d.close_date, today) < 0) reasons.push(`close date passed ${relDays(daysUntil(d.close_date, today))}`);
      const idle = -daysUntil(d.updated_at, today);
      if (idle >= STALE_DAYS) reasons.push(`no updates for ${idle} days`);
      if (!d.close_date) reasons.push("no close date");
      if (reasons.length && (reasons.length > 1 || reasons[0] !== "no close date")) {
        atRisk.push({ id: d.id, title: d.title, reason: reasons.join(", ") });
      }
    }
    atRisk.sort((a, b) => {
      const va = Number(open.find((d) => d.id === a.id)?.value ?? 0);
      const vb = Number(open.find((d) => d.id === b.id)?.value ?? 0);
      return vb - va;
    });
    if (atRisk.length) {
      lines.push("");
      lines.push(`RISK SIGNALS (${atRisk.length} open deals):`);
      for (const r of atRisk.slice(0, 15)) lines.push(`- "${clip(r.title, 80)}": ${r.reason}`);
    }
  }

  // Tasks
  const openTasks = snap.tasks.filter((t) => !t.completed);
  const overdue = openTasks.filter((t) => t.due_date && daysUntil(t.due_date, today) < 0);
  const soon = openTasks.filter((t) => t.due_date && daysUntil(t.due_date, today) >= 0 && daysUntil(t.due_date, today) <= 7);
  lines.push("");
  lines.push(`TASKS: ${overdue.length} overdue, ${soon.length} due in the next 7 days.`);
  for (const t of overdue.slice(0, 10)) lines.push(`- overdue: "${clip(t.title, 80)}" (due ${t.due_date}, ${t.priority ?? "normal"} priority)`);
  for (const t of soon.slice(0, 10)) lines.push(`- upcoming: "${clip(t.title, 80)}" (due ${t.due_date}, ${t.priority ?? "normal"} priority)`);

  // Activities
  if (snap.activities.length) {
    lines.push("");
    lines.push(`RECENT ACTIVITY (latest ${snap.activities.length}):`);
    for (const a of snap.activities) {
      const desc = a.description ? ` — ${clip(a.description, 100)}` : "";
      lines.push(`- ${toIsoDate(new Date(a.created_at))} ${a.type}: ${clip(a.title, 80)}${desc}`);
    }
  }

  let text = lines.join("\n");
  if (text.length > MAX_CHARS) text = `${text.slice(0, MAX_CHARS)}\n(…summary truncated)`;

  // Follow-up candidate: the biggest at-risk deal, else the biggest open deal closing soonest.
  const followUp =
    atRisk[0] ??
    [...open]
      .filter((d) => d.close_date && daysUntil(d.close_date, today) >= 0)
      .sort((a, b) => daysUntil(a.close_date!, today) - daysUntil(b.close_date!, today))[0] ??
    [...open].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0))[0];

  return {
    text,
    openDealCount: open.length,
    openValue,
    atRisk,
    followUpDeal: followUp ? { id: followUp.id, title: followUp.title } : null,
    overdueTaskCount: overdue.length,
    isEmpty: snap.deals.length === 0 && snap.tasks.length === 0 && snap.activities.length === 0,
  };
}

/** Fetches a bounded snapshot of the current workspace (RLS scopes every query). */
export async function fetchWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const [pipelinesRes, stagesRes, dealsRes, tasksRes, activitiesRes] = await Promise.all([
    supabase.from("pipelines").select("id, name").order("created_at", { ascending: true }).limit(10),
    supabase.from("pipeline_stages").select("*").order("position", { ascending: true }).limit(200),
    supabase
      .from("deals")
      .select(
        "id, title, value, probability, close_date, stage_id, pipeline_id, notes, updated_at, companies(name), contacts(first_name, last_name)",
        { count: "exact" },
      )
      .order("value", { ascending: false, nullsFirst: false })
      .limit(DEAL_LIMIT),
    supabase
      .from("tasks")
      .select("id, title, due_date, priority, completed")
      .eq("completed", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(40),
    supabase
      .from("activities")
      .select("id, type, title, description, created_at")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const firstError = [pipelinesRes, stagesRes, dealsRes, tasksRes, activitiesRes].find((r) => r.error)?.error;
  if (firstError) throw firstError;

  const deals = (dealsRes.data ?? []) as unknown as CtxDeal[];
  return {
    pipelines: (pipelinesRes.data ?? []) as { id: string; name: string }[],
    stages: (stagesRes.data ?? []) as unknown as CtxStage[],
    deals,
    dealCount: dealsRes.count ?? deals.length,
    tasks: (tasksRes.data ?? []) as unknown as CtxTask[],
    activities: (activitiesRes.data ?? []) as unknown as CtxActivity[],
  };
}
