import { formatDistanceToNow, format, isToday, isTomorrow, isYesterday } from "date-fns";

const currencyFormatters = new Map<string, Intl.NumberFormat>();

/** Formats money in the workspace currency (pass `organization?.currency`); defaults to ETB. */
export function formatCurrency(value: number | null | undefined, currency = "ETB"): string {
  const key = currency || "ETB";
  let fmt = currencyFormatters.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat(undefined, { style: "currency", currency: key, minimumFractionDigits: 0, maximumFractionDigits: 0 });
    } catch {
      fmt = new Intl.NumberFormat(undefined, { style: "currency", currency: "ETB", minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    currencyFormatters.set(key, fmt);
  }
  return fmt.format(Number(value ?? 0));
}

/** Compact money for tight spaces and chart axes: $1.2M, $840K. */
export function formatCompactCurrency(value: number | null | undefined, currency = "ETB"): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "ETB", notation: "compact", maximumFractionDigits: 1 }).format(Number(value ?? 0));
  } catch {
    return formatCurrency(value, currency);
  }
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat().format(Number(value ?? 0));
}

/** 0.4567 → "45.7%"; pass already-multiplied values with `isRatio=false`. */
export function formatPercent(value: number | null | undefined, isRatio = true, digits = 0): string {
  const v = Number(value ?? 0) * (isRatio ? 1 : 0.01);
  return new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: digits }).format(v);
}

/**
 * A bare `date` column ("2026-10-07") as LOCAL midnight. `new Date("2026-10-07")` is UTC midnight,
 * which is the previous day west of UTC. Timestamps and Date objects are parsed as usual.
 */
export function toDate(date: string | Date): Date {
  if (date instanceof Date) return date;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(date);
}

export function formatRelativeDate(date: string | Date): string {
  return formatDistanceToNow(toDate(date), { addSuffix: true });
}

export function formatDate(date: string | Date): string {
  return format(toDate(date), "MMM d, yyyy");
}

/** "Today", "Tomorrow", "Yesterday", else "Mar 4" (or "Mar 4, 2025" outside the current year). */
export function formatFriendlyDate(date: string | Date): string {
  const d = toDate(date);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isYesterday(d)) return "Yesterday";
  return format(d, d.getFullYear() === new Date().getFullYear() ? "MMM d" : "MMM d, yyyy");
}
