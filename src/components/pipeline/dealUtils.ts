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
  /** Only deals in open (not won/lost) stages — set by the "Past due" preset. */
  openOnly: boolean;
}

export const EMPTY_DEAL_FILTERS: DealFilters = { search: "", owner: "all", closeFrom: "", closeTo: "", minValue: "", openOnly: false };

export function hasActiveDealFilters(f: DealFilters): boolean {
  return !!(f.search.trim() || f.owner !== "all" || f.closeFrom || f.closeTo || f.minValue.trim() || f.openOnly);
}

type StageFlags = Pick<PipelineStage, "id" | "is_won" | "is_lost">;

/** Ids of won/lost stages. */
function closedStageIds(stages: StageFlags[]): Set<string> {
  return new Set(stages.filter((s) => s.is_won || s.is_lost).map((s) => s.id));
}

/** Deals in open stages (deals whose stage is unknown count as open). */
export function openDeals<T extends Pick<Deal, "stage_id">>(deals: T[], stages: StageFlags[]): T[] {
  const closed = closedStageIds(stages);
  return deals.filter((d) => !closed.has(d.stage_id));
}

/**
 * Client-side filtering of a pipeline's deals (the board holds every deal of the pipeline).
 * `stages` is needed for `openOnly`; without it that filter is ignored.
 */
export function filterDeals<T extends Deal>(deals: T[], f: DealFilters, currentUserId: string | null | undefined, stages?: StageFlags[]): T[] {
  const term = f.search.trim().toLowerCase();
  const min = f.minValue.trim() === "" ? null : Number(f.minValue);
  const ownerId = f.owner === "mine" ? currentUserId ?? "__none__" : f.owner === "all" ? null : f.owner;
  const closed = f.openOnly && stages ? closedStageIds(stages) : null;
  return deals.filter((d) => {
    if (closed?.has(d.stage_id)) return false;
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

/** Largest amount a deal value column (NUMERIC(14,2)) can hold. */
export const MAX_DEAL_VALUE = 999_999_999_999.99;

/** `error` is set when the input is invalid; otherwise `value` is the number, or `null` for a blank input. */
export type ParsedNumber = { value: number | null; error: string | null };

const invalid = (error: string): ParsedNumber => ({ value: null, error });

/**
 * Parses a typed money amount. Commas and spaces are treated as thousands separators
 * ("1,500.50", "1 500"); blank parses to `null`. At most 2 decimals, 0 to MAX_DEAL_VALUE.
 */
export function parseDealValue(raw: string): ParsedNumber {
  const s = raw.replace(/[,\s]/g, "");
  if (s === "") return { value: null, error: null };
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return invalid("Enter an amount of 0 or more, like 1,500.00");
  if ((s.split(".")[1] ?? "").length > 2) return invalid("Use at most 2 decimal places");
  const value = Number(s);
  if (!Number.isFinite(value) || value > MAX_DEAL_VALUE) return invalid("Enter an amount up to 999,999,999,999.99");
  return { value, error: null };
}

/** Parses a typed probability ("40", "40%"); blank parses to `null`. Rounded to a whole number, 0 to 100. */
export function parseDealProbability(raw: string): ParsedNumber {
  const s = raw.replace(/[\s%]/g, "");
  if (s === "") return { value: null, error: null };
  const n = /^(\d+(\.\d*)?|\.\d+)$/.test(s) ? Number(s) : NaN;
  if (!Number.isFinite(n) || n > 100) return invalid("Enter a number from 0 to 100");
  return { value: Math.round(n), error: null };
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
