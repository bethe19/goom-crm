import { useId, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, BarChart3, Minus, Table2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------------------------
// Tooltip body
// ---------------------------------------------------------------------------------------------

export interface ChartTooltipRow {
  label: string;
  value: string;
  color?: string;
  /** Key shape: a short stroke for lines (default), a square for bars/areas. */
  shape?: "line" | "rect";
  muted?: boolean;
}

/** Tooltip for recharts `content`: values lead (strong), series names follow; keys carry identity. */
export function ChartTooltipBox({ title, rows, footer }: { title: string; rows: ChartTooltipRow[]; footer?: React.ReactNode }) {
  return (
    <div className="min-w-[180px] max-w-[280px] rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <div className="mb-1.5 text-muted-foreground">{title}</div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            {r.color ? (
              <span
                aria-hidden
                className={cn("shrink-0", r.shape === "rect" ? "h-2.5 w-2.5 rounded-[3px]" : "h-0.5 w-3 rounded-full")}
                style={{ backgroundColor: r.color }}
              />
            ) : (
              <span aria-hidden className="w-3 shrink-0" />
            )}
            <span className={cn("font-semibold tabular-nums", r.muted ? "text-muted-foreground" : "text-foreground")}>{r.value}</span>
            <span className="ml-auto pl-3 text-muted-foreground">{r.label}</span>
          </div>
        ))}
      </div>
      {footer && <div className="mt-2 border-t border-border pt-1.5 text-muted-foreground">{footer}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------------------------

export interface LegendItem {
  label: string;
  color: string;
  shape?: "rect" | "line";
  value?: string;
}

export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)} aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className={cn("shrink-0", i.shape === "line" ? "h-0.5 w-3.5 rounded-full" : "h-2.5 w-2.5 rounded-[3px]")}
            style={{ backgroundColor: i.color }}
          />
          <span>{i.label}</span>
          {i.value && <span className="font-medium tabular-nums text-foreground">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------------
// Table view (every chart has one)
// ---------------------------------------------------------------------------------------------

export interface ChartTableData {
  columns: string[];
  rows: (string | number)[][];
  /** Right-align these column indexes (numbers). Defaults to every column but the first. */
  numeric?: number[];
}

export function ChartTable({ data, caption }: { data: ChartTableData; caption?: string }) {
  const numeric = new Set(data.numeric ?? data.columns.map((_, i) => i).filter((i) => i > 0));
  return (
    <div className="max-h-[320px] overflow-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="sticky top-0 bg-muted/60 backdrop-blur">
          <tr>
            {data.columns.map((c, i) => (
              <th key={c} scope="col" className={cn("px-3 py-2 text-xs font-medium text-muted-foreground", numeric.has(i) ? "text-right" : "text-left")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r, ri) => (
            <tr key={ri} className="border-t border-border">
              {r.map((cell, ci) =>
                ci === 0 ? (
                  <th key={ci} scope="row" className="px-3 py-1.5 text-left font-normal text-foreground">
                    {cell}
                  </th>
                ) : (
                  <td key={ci} className={cn("px-3 py-1.5 tabular-nums", numeric.has(ci) ? "text-right" : "text-left")}>
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Section card
// ---------------------------------------------------------------------------------------------

/** Card shell for dashboard/report sections: title row + optional action + chart/table toggle. */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  table,
  headline,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** When given, a toggle swaps the chart for an accessible table of the same numbers. */
  table?: ChartTableData | null;
  /** Big figure under the title (e.g. period total + delta). */
  headline?: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  const titleId = useId();
  const showTable = asTable && !!table;
  return (
    <section className={cn("flex min-w-0 flex-col rounded-xl border border-border bg-card", className)} aria-labelledby={titleId}>
      <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="min-w-0">
          <h2 id={titleId} className="text-sm font-semibold text-foreground">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {(action || table) && (
          <div className="flex shrink-0 items-center gap-1.5">
            {action}
            {table && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setAsTable((v) => !v)}
                    aria-pressed={showTable}
                    aria-label={showTable ? `Show ${title} as a chart` : `Show ${title} as a table`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showTable ? <BarChart3 className="h-4 w-4" aria-hidden /> : <Table2 className="h-4 w-4" aria-hidden />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{showTable ? "Show chart" : "Show table"}</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
      {headline && <div className="px-4 pt-2 sm:px-5">{headline}</div>}
      <div className={cn("flex-1 px-4 pb-4 pt-3 sm:px-5", bodyClassName)}>
        {showTable && table ? <ChartTable data={table} caption={title} /> : children}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Segmented control (view modes / ranges)
// ---------------------------------------------------------------------------------------------

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg border border-border bg-secondary/60 p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const i = options.findIndex((x) => x.value === value);
              const next = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
              onChange(next.value);
              const group = e.currentTarget.parentElement;
              requestAnimationFrame(() => (group?.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus());
            }}
            className={cn(
              "h-7 rounded-md px-2.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Delta chip
// ---------------------------------------------------------------------------------------------

/**
 * Signed change with direction icon. `kind` = "pct" (relative change ratio), "pp" (difference of two
 * ratios, shown in points) or "days". Color = direction × whether up is good; the icon + sign
 * carry the meaning too, so color is never the only signal.
 */
export function DeltaChip({
  value,
  kind = "pct",
  goodWhen = "up",
  className,
}: {
  value: number;
  kind?: "pct" | "pp" | "days";
  goodWhen?: "up" | "down";
  className?: string;
}) {
  const flat = kind === "days" ? Math.abs(value) < 0.5 : Math.abs(value) < 0.005;
  const up = value > 0;
  const good = flat ? null : goodWhen === "up" ? up : !up;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const text =
    kind === "pct"
      ? `${sign}${new Intl.NumberFormat(undefined, { maximumFractionDigits: abs < 0.1 ? 1 : 0 }).format(abs * 100)}%`
      : kind === "pp"
        ? `${sign}${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(abs * 100)} pts`
        : `${sign}${Math.round(abs)} ${Math.round(abs) === 1 ? "day" : "days"}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium tabular-nums",
        good === null ? "text-muted-foreground" : good ? "text-success" : "text-destructive",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {flat ? "No change" : text}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Designed empty state for charts
// ---------------------------------------------------------------------------------------------

/**
 * Empty chart area that still looks designed: faint gridlines and a decorative outline (no axes,
 * no numbers — nothing that could be read as data) behind a short message and next step.
 */
export function ChartEmpty({
  icon: Icon,
  title,
  description,
  action,
  height = 220,
  variant = "area",
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  height?: number;
  variant?: "area" | "bars";
}) {
  return (
    <div className="relative overflow-hidden rounded-lg" style={{ height }}>
      <svg aria-hidden className="absolute inset-0 h-full w-full text-border" preserveAspectRatio="none" viewBox="0 0 300 100">
        {[20, 45, 70, 95].map((y) => (
          <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {variant === "area" ? (
          <path
            d="M0 80 C 40 76, 60 60, 100 64 S 160 40, 200 46 S 260 26, 300 30"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="0"
            vectorEffect="non-scaling-stroke"
            opacity="0.9"
          />
        ) : (
          [30, 70, 110, 150, 190, 230, 270].map((x, i) => (
            <rect key={x} x={x - 9} width="18" y={95 - [30, 45, 38, 55, 48, 62, 58][i]} height={[30, 45, 38, 55, 48, 62, 58][i]} rx="3" fill="currentColor" opacity="0.55" />
          ))
        )}
      </svg>
      <div className="relative flex h-full flex-col items-center justify-center bg-gradient-to-b from-card/40 via-card/85 to-card/40 px-6 text-center">
        <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="mt-1 max-w-xs text-xs text-muted-foreground text-balance">{description}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

/** Held-frame wrapper: while a query refetches, keep the previous render at reduced opacity. */
export function Refetching({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return <div className={cn("transition-opacity duration-200", active && "opacity-60")}>{children}</div>;
}
