/**
 * Shared chart styling so every chart reads as one system.
 *
 * Categorical slots (validated with the dataviz palette validator, adjacent pairs):
 * - light (on #ffffff): the brand chart tokens --chart-2 / --chart-4 / --chart-3 / --chart-5 in this
 *   order pass lightness, chroma, CVD (worst ΔE 8.3) and normal-vision (25.4) checks. Slot 2
 *   (orange) is 2.6:1 on white, so every chart using it ships a legend + table view.
 * - dark (on the dark card): the brand dark tokens are too light for the dark band, so dark mode
 *   uses its own validated steps of the same hues (worst CVD ΔE 9.4, all ≥ 3:1).
 * The variables are declared on the page root with `VIZ_VARS` (light + `.dark`).
 */
export const VIZ_VARS = [
  "[--viz-1:hsl(var(--chart-2))]",
  "[--viz-2:hsl(var(--chart-4))]",
  "[--viz-3:hsl(var(--chart-3))]",
  "[--viz-4:hsl(var(--chart-5))]",
  "dark:[--viz-1:#3987e5]",
  "dark:[--viz-2:#d95926]",
  "dark:[--viz-3:#199e70]",
  "dark:[--viz-4:#9085e9]",
].join(" ");

/** Fallbacks keep charts colored where VIZ_VARS isn't declared (e.g. other pages importing these). */
export const SERIES = [
  "var(--viz-1, hsl(var(--chart-2)))",
  "var(--viz-2, hsl(var(--chart-4)))",
  "var(--viz-3, hsl(var(--chart-3)))",
  "var(--viz-4, hsl(var(--chart-5)))",
] as const;
/** The single-series accent (slot 1). */
export const ACCENT = SERIES[0];

/** Status colors: only where the mark MEANS good/bad (won/lost, overdue); always with a label. */
export const WON_COLOR = "hsl(var(--success))";
export const LOST_COLOR = "hsl(var(--destructive))";
export const WARNING_COLOR = "hsl(var(--warning))";

export const INK = "hsl(var(--foreground))";
/** De-emphasis / comparison series. */
export const MUTED_SERIES = "hsl(var(--muted-foreground))";
export const SURFACE = "hsl(var(--card))";

export const AXIS_TICK = { fontSize: 12, fill: "hsl(var(--muted-foreground))" } as const;
/** Gridlines: solid hairlines one step off the surface. */
export const GRID_STROKE = "hsl(var(--border))";
export const CURSOR_FILL = { fill: "hsl(var(--muted) / 0.5)" } as const;
export const CROSSHAIR = { stroke: "hsl(var(--muted-foreground) / 0.5)", strokeWidth: 1 } as const;
/** Kept for older imports (platform console): ink. New charts use ACCENT. */
export const SERIES_PRIMARY = INK;

export const ACTIVITY_SERIES: { key: "call" | "email" | "meeting" | "note"; label: string; color: string }[] = [
  { key: "call", label: "Calls", color: SERIES[0] },
  { key: "email", label: "Emails", color: SERIES[1] },
  { key: "meeting", label: "Meetings", color: SERIES[2] },
  { key: "note", label: "Notes", color: SERIES[3] },
];

/** Stage colors come from the data (user-chosen); fall back to the accent. */
export function stageColor(color: string | null | undefined): string {
  return color && color.trim() ? color : ACCENT;
}
