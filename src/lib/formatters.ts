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
    return formatCurrency(value, "ETB");
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

export function formatRelativeDate(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "MMM d, yyyy");
}

/** "Today", "Tomorrow", "Yesterday", else "Mar 4" (or "Mar 4, 2025" outside the current year). */
export function formatFriendlyDate(date: string | Date): string {
  const d = new Date(date);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isYesterday(d)) return "Yesterday";
  return format(d, d.getFullYear() === new Date().getFullYear() ? "MMM d" : "MMM d, yyyy");
}
