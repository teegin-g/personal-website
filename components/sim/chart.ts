/**
 * Centralized, theme-native style tokens for simulator charts.
 *
 * The d3 geometry (scales, positioning, hit-testing) stays in each sim; this
 * module only owns the *look* — colors, hairlines, axis treatment, tooltip
 * surface — so every figure reads from the same OKLCH theme vars and renders
 * natively in both `phosphor` (night) and `ledger` (day).
 *
 * Values are either Tailwind class strings (apply via `className`) or raw CSS
 * var references (apply inline, e.g. `style={{ background: CHART.userFill }}`)
 * where the geometry needs per-element opacity from rgba/color-mix.
 */

/** Tailwind class strings for the common chart chrome. */
export const CHART = {
  /** Dashed gridlines / hairline rules — includes `border-dashed`. */
  gridLine: "border-grid-line border-dashed",
  /** Solid axis baseline (e.g. the L-shaped x/y origin lines) — includes `border-solid`. */
  axisLine: "border-grid-line border-solid",
  /** Axis tick labels and other genuinely secondary chart text. */
  axisText: "text-muted text-[11px]",
  /** The user's own series — the figure of interest. High contrast. */
  userSeries: "text-ink",
  /** Rival / peer series — present but recessive. */
  rivalSeries: "text-muted",
  /** Distribution tail / faded points. */
  tailSeries: "text-muted",
  /** Floating tooltip card surface. */
  tooltipSurface:
    "rounded-2xl border border-grid-line bg-panel px-3 py-2 text-xs text-body shadow-xl",
} as const;

/**
 * Raw CSS color expressions for inline use where a class won't reach
 * (SVG fill/stroke, rgba dot fills, color-mix tints). These reference the
 * live theme vars, so they re-resolve when `data-theme` flips.
 */
export const CHART_COLOR = {
  /** Teal accent — the brand series color. */
  accent: "var(--accent)",
  /** Strong ink — the user's emphasized marks. */
  ink: "var(--ink)",
  /** Muted neutral — recessive marks / tails. */
  muted: "var(--muted)",
  gridLine: "var(--grid-line)",
  positive: "var(--positive)",
  danger: "var(--danger)",
  /** Fill for the user's dot — accent at low alpha over the panel. */
  userFill: "color-mix(in oklab, var(--accent) 22%, transparent)",
  /** Fill for rival dots — muted at low alpha. */
  rivalFill: "color-mix(in oklab, var(--muted) 28%, transparent)",
  /** Fill for tail dots — muted, fainter still. */
  tailFill: "color-mix(in oklab, var(--muted) 16%, transparent)",
} as const;

/**
 * Build an `oklch`-faithful translucent tint of a theme var at the given
 * alpha (0–1). Handy for d3-driven fills that need variable opacity.
 */
export function tint(cssVar: string, alpha: number): string {
  const pct = Math.round(Math.max(0, Math.min(1, alpha)) * 100);
  return `color-mix(in oklab, ${cssVar} ${pct}%, transparent)`;
}
