import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ACCENT } from "./chartTheme";

export interface SparkPoint {
  label: string;
  /** null = no value for this bucket (drawn as a gap). */
  value: number | null;
  /** Formatted value for the readout. */
  display: string;
}

/**
 * Stat-tile trend: a de-emphasized line with the current (last) period in the accent. Hover or
 * arrow keys move a readout across the points; the readout text is the accessible value.
 */
export function Sparkline({ points, label, className }: { points: SparkPoint[]; label: string; className?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const geometry = useMemo(() => {
    const vals = points.map((p) => p.value).filter((v): v is number => v !== null);
    if (points.length < 2 || !vals.length) return null;
    const min = Math.min(0, ...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const x = (i: number) => (i / (points.length - 1)) * 100;
    const y = (v: number) => 92 - ((v - min) / span) * 84; // 8% headroom, 8% floor
    const segments: string[] = [];
    let current = "";
    points.forEach((p, i) => {
      if (p.value === null) {
        if (current) segments.push(current);
        current = "";
        return;
      }
      current += `${current ? "L" : "M"}${x(i).toFixed(2)} ${y(p.value).toFixed(2)} `;
    });
    if (current) segments.push(current);
    const line = segments.join(" ");
    const firstIdx = points.findIndex((p) => p.value !== null);
    let lastIdx = points.length - 1;
    while (lastIdx >= 0 && points[lastIdx].value === null) lastIdx--;
    // Area wash only when there are no gaps (a broken area reads as missing data).
    const area =
      segments.length === 1 ? `${line} L${x(lastIdx).toFixed(2)} 100 L${x(firstIdx).toFixed(2)} 100 Z` : null;
    return { line, area, x, y, lastIdx };
  }, [points]);

  if (!geometry) return null;
  const shown = active ?? geometry.lastIdx;
  const p = points[shown];
  const dotLeft = geometry.x(shown);
  const dotTop = p?.value !== null && p?.value !== undefined ? geometry.y(p.value) : null;

  return (
    <div className={cn("mt-3", className)}>
      <div
        className="relative h-9 w-full cursor-crosshair rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={0}
        role="img"
        aria-label={`${label}: ${points.map((pt) => `${pt.label} ${pt.display}`).join(", ")}`}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
          setActive(Math.round(ratio * (points.length - 1)));
        }}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          setActive((prev) => {
            const from = prev ?? geometry.lastIdx;
            return Math.min(Math.max(from + (e.key === "ArrowRight" ? 1 : -1), 0), points.length - 1);
          });
        }}
      >
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {geometry.area && <path d={geometry.area} fill={ACCENT} opacity={0.1} />}
          <path
            d={geometry.line}
            fill="none"
            stroke="hsl(var(--muted-foreground))"
            strokeOpacity={0.55}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {active !== null && (
          <span aria-hidden className="absolute inset-y-0 w-px bg-border" style={{ left: `${dotLeft}%` }} />
        )}
        {dotTop !== null && (
          <span
            aria-hidden
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
            style={{ left: `${dotLeft}%`, top: `${dotTop}%`, backgroundColor: ACCENT }}
          />
        )}
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground" aria-live="polite">
        <span>{points[0]?.label}</span>
        {p && (
          <span className={cn("tabular-nums", active !== null && "font-medium text-foreground")}>
            {p.label}: {p.display}
          </span>
        )}
      </div>
    </div>
  );
}
