import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/States";
import { formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { WEEKDAY_LABELS, type ActivityHeatmap as HeatmapData } from "@/hooks/useAnalytics";
import { ChartEmpty, SectionCard } from "./ChartParts";
import { ACCENT } from "./chartTheme";

/** Sequential ramp: one hue, five steps by opacity over the card (0 = empty cell). */
const STEPS = [0.18, 0.36, 0.56, 0.78, 1];

function stepFor(count: number, max: number): number {
  if (count <= 0 || max <= 0) return -1;
  return Math.min(STEPS.length - 1, Math.floor((count / max) * STEPS.length - 1e-9));
}

function hourRange(h: number) {
  const fmt = (x: number) => `${String(x % 24).padStart(2, "0")}:00`;
  return `${fmt(h)}–${fmt(h + 1)}`;
}

/** When activities get logged: weekday × hour of day, in the viewer's local time. */
export function ActivityHeatmap({
  data,
  loading,
  error,
  onRetry,
  description,
  className,
  title = "When activity happens",
}: {
  title?: string;
  data: HeatmapData | null;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  description?: React.ReactNode;
  className?: string;
}) {
  const [cursor, setCursor] = useState<{ day: number; hour: number } | null>(null);
  const [focused, setFocused] = useState(false);
  const total = data?.total ?? 0;
  const peak = data?.peak ?? null;
  const shown = cursor ?? (peak ? { day: peak.day, hour: peak.hour } : null);
  const shownCount = shown && data ? data.grid[shown.day][shown.hour] : 0;

  const move = (dDay: number, dHour: number) =>
    setCursor((c) => {
      const from = c ?? (peak ? { day: peak.day, hour: peak.hour } : { day: 0, hour: 9 });
      return { day: (from.day + dDay + 7) % 7, hour: (from.hour + dHour + 24) % 24 };
    });

  const table =
    data && total > 0
      ? {
          columns: ["Day", "Night (0–6)", "Morning (6–12)", "Afternoon (12–18)", "Evening (18–24)", "Total"],
          rows: data.grid.map((row, d) => {
            const part = (a: number, b: number) => row.slice(a, b).reduce((s, x) => s + x, 0);
            return [WEEKDAY_LABELS[d], part(0, 6), part(6, 12), part(12, 18), part(18, 24), part(0, 24)];
          }),
        }
      : null;

  return (
    <SectionCard title={title} description={description} className={className} table={table}>
      {loading ? (
        <Skeleton className="h-[220px] w-full rounded-lg" />
      ) : error ? (
        <ErrorState compact error={error} onRetry={onRetry} title="Couldn't load activities" />
      ) : !data || total === 0 ? (
        <ChartEmpty icon={CalendarClock} title="No activity to map yet" description="Log calls, emails and meetings to see which days and hours are busiest." variant="bars" />
      ) : (
        <div>
          <div
            role="img"
            tabIndex={0}
            aria-label={`Activity by weekday and hour, ${formatNumber(total)} activities. ${peak ? `Busiest: ${WEEKDAY_LABELS[peak.day]} ${hourRange(peak.hour)} with ${peak.count}.` : ""} Use arrow keys to explore; the table view lists every day.`}
            onKeyDown={(e) => {
              const map: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
              const m = map[e.key];
              if (!m) return;
              e.preventDefault();
              move(m[0], m[1]);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              setCursor(null);
            }}
            onPointerLeave={() => setCursor(null)}
            className="overflow-x-auto rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="grid min-w-[340px] grid-cols-[2.25rem_repeat(24,minmax(0,1fr))] gap-[2px]">
              {data.grid.map((row, d) => (
                <div key={d} className="contents">
                  <div className="flex items-center text-[11px] text-muted-foreground">{WEEKDAY_LABELS[d]}</div>
                  {row.map((count, h) => {
                    const step = stepFor(count, data.max);
                    const active = shown && shown.day === d && shown.hour === h && (cursor !== null || focused);
                    return (
                      <div
                        key={h}
                        onPointerEnter={() => setCursor({ day: d, hour: h })}
                        className={cn("h-5 rounded-[3px] sm:h-6", step < 0 && "bg-secondary", active && "ring-2 ring-foreground ring-offset-1 ring-offset-card")}
                        style={step >= 0 ? { backgroundColor: ACCENT, opacity: STEPS[step] } : undefined}
                      />
                    );
                  })}
                </div>
              ))}
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="pt-1 text-center text-[11px] tabular-nums text-muted-foreground">
                  {h % 6 === 0 ? String(h).padStart(2, "0") : ""}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground" aria-live="polite">
              {shown ? (
                <>
                  <span className="font-medium text-foreground">
                    {WEEKDAY_LABELS[shown.day]} {hourRange(shown.hour)}
                  </span>{" "}
                  · {formatNumber(shownCount)} {shownCount === 1 ? "activity" : "activities"}
                  {!cursor && peak ? " (busiest)" : ""}
                </>
              ) : null}
            </p>
            <div className="flex items-center gap-1.5 text-muted-foreground" aria-hidden>
              <span>Less</span>
              <span className="h-3 w-3 rounded-[3px] bg-secondary" />
              {STEPS.map((o) => (
                <span key={o} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: ACCENT, opacity: o }} />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
