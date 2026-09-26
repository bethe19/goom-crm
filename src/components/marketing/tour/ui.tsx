import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanFeature } from "@/lib/plans";
import { plansWithFeature } from "./data";

/** Initials avatar used throughout the tour. */
export function Avatar({ initials, className, title }: { initials: string; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-foreground ring-1 ring-border",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function SceneHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold tracking-tight">{title}</h3>
        {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

/** Small pill button used for segmented controls inside scenes. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-border bg-secondary/60 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function PlanChip({ feature, className }: { feature: PlanFeature; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      <Lock className="h-3 w-3" aria-hidden="true" />
      {plansWithFeature(feature)}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-lg border border-border bg-card", className)}>{children}</div>;
}

export function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}

/** Polite live region announcing what just happened in the tour. */
export function LiveStatus({ message }: { message: string | null }) {
  return (
    <p aria-live="polite" className="min-h-[1rem] text-xs text-muted-foreground">
      {message}
    </p>
  );
}

/** Tooltip body shared by all recharts charts in the tour. */
export function ChartTooltipBox({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; swatch?: string }[];
}) {
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{title}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          {r.swatch && <span className="h-2 w-2 rounded-sm" style={{ background: r.swatch }} />}
          <span className="text-muted-foreground">{r.label}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export const CHART = {
  ink: "hsl(var(--chart-1))",
  blue: "hsl(var(--chart-2))",
  green: "hsl(var(--chart-3))",
  grid: "hsl(var(--border))",
  axis: "hsl(var(--muted-foreground))",
  surface: "hsl(var(--card))",
} as const;
