import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import type { Deal } from "@/hooks/useDeals";
import type { PipelineStage } from "@/hooks/usePipelineStages";

export interface DealFilters {
  search: string;
  /** "all", "mine", or a member user id. */
  owner: string;
  /** yyyy-MM-dd, inclusive. */
  closeFrom: string;
  closeTo: string;
  /** Minimum deal value, as typed (blank = no minimum). */
  minValue: string;
}

export const EMPTY_DEAL_FILTERS: DealFilters = { search: "", owner: "all", closeFrom: "", closeTo: "", minValue: "" };

export function hasActiveDealFilters(f: DealFilters): boolean {
  return !!(f.search.trim() || f.owner !== "all" || f.closeFrom || f.closeTo || f.minValue.trim());
}

/** Client-side filtering of a pipeline's deals (the board holds every deal of the pipeline). */
export function filterDeals<T extends Deal>(deals: T[], f: DealFilters, currentUserId: string | null | undefined): T[] {
  const term = f.search.trim().toLowerCase();
  const min = f.minValue.trim() === "" ? null : Number(f.minValue);
  const ownerId = f.owner === "mine" ? currentUserId ?? "__none__" : f.owner === "all" ? null : f.owner;
  return deals.filter((d) => {
    if (term) {
      const haystack = [d.title, d.companies?.name, d.contacts?.first_name, d.contacts?.last_name, d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name}` : ""]
        .filter(Boolean)
        .join(" \u0000 ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (ownerId && d.owner_id !== ownerId) return false;
    if (min !== null && !Number.isNaN(min) && Number(d.value || 0) < min) return false;
    if (f.closeFrom || f.closeTo) {
      if (!d.close_date) return false;
      const day = d.close_date.slice(0, 10);
      if (f.closeFrom && day < f.closeFrom) return false;
      if (f.closeTo && day > f.closeTo) return false;
    }
    return true;
  });
}

export interface StageSummary {
  count: number;
  total: number;
  weighted: number;
}

export function summarizeDeals(deals: Pick<Deal, "value" | "probability">[]): StageSummary {
  let total = 0;
  let weighted = 0;
  for (const d of deals) {
    const v = Number(d.value || 0);
    total += v;
    weighted += (v * Math.max(0, Math.min(100, Number(d.probability || 0)))) / 100;
  }
  return { count: deals.length, total, weighted };
}

/** A deal is overdue when its close date is before today and it sits in an open (not won/lost) stage. */
export function isDealOverdue(deal: Pick<Deal, "close_date">, stage: Pick<PipelineStage, "is_won" | "is_lost"> | undefined, now: Date = new Date()): boolean {
  if (!deal.close_date || stage?.is_won || stage?.is_lost) return false;
  return parseISO(deal.close_date.slice(0, 10)) < startOfDay(now);
}

/** Whole days since `since` (never negative). */
export function daysSince(since: string | null | undefined, now: Date = new Date()): number | null {
  if (!since) return null;
  const d = parseISO(since);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, differenceInCalendarDays(now, d));
}

export type DealSortKey = "title" | "company" | "stage" | "owner" | "value" | "probability" | "close_date";
export type SortDir = "asc" | "desc";

export interface DealSortContext {
  stagePosition: (stageId: string) => number;
  ownerName: (ownerId: string | null) => string;
}

/** Stable sort for the list view; blanks always sort last. */
export function sortDeals<T extends Deal>(deals: T[], key: DealSortKey, dir: SortDir, ctx: DealSortContext): T[] {
  const sign = dir === "asc" ? 1 : -1;
  const val = (d: T): string | number | null => {
    switch (key) {
      case "title":
        return d.title.toLowerCase();
      case "company":
        return d.companies?.name?.toLowerCase() ?? null;
      case "stage":
        return ctx.stagePosition(d.stage_id);
      case "owner":
        return ctx.ownerName(d.owner_id)?.toLowerCase() || null;
      case "value":
        return Number(d.value || 0);
      case "probability":
        return Number(d.probability || 0);
      case "close_date":
        return d.close_date ?? null;
    }
  };
  return deals
    .map((d, i) => ({ d, i, v: val(d) }))
    .sort((a, b) => {
      if (a.v === null && b.v === null) return a.i - b.i;
      if (a.v === null) return 1;
      if (b.v === null) return -1;
      if (a.v < b.v) return -1 * sign;
      if (a.v > b.v) return 1 * sign;
      return a.i - b.i;
    })
    .map((x) => x.d);
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "")).toUpperCase();
}
