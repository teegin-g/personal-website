import type { ReactNode } from "react";

import { deltaTone } from "@/lib/sim/format";

interface SimReadoutProps {
  /** Short uppercase label (mono caption). */
  label: string;
  /** Pre-formatted value string (use lib/sim/format helpers). */
  value: string;
  /**
   * Optional signed delta. When present, the value is toned via `deltaTone`:
   * >= 0 → `text-positive`, < 0 → `text-danger`.
   */
  delta?: number;
  /** Genuinely secondary context under the value. */
  sublabel?: string;
}

/**
 * A single quiet readout: mono caption, large tabular value, optional sublabel.
 * Deliberately NOT an icon+heading+text card — no surface, no border, no icon.
 * Use inside `SimReadoutRow` for the full strip.
 */
export function SimReadout({ label, value, delta, sublabel }: SimReadoutProps) {
  const valueTone =
    delta === undefined
      ? "text-ink"
      : deltaTone(delta) === "positive"
        ? "text-positive"
        : "text-danger";

  return (
    <div className="min-w-0">
      <div className="font-mono text-[11px] uppercase tracking-wide text-muted">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-2xl font-semibold tabular-nums leading-none tracking-[-0.01em] ${valueTone}`}
      >
        {value}
      </div>
      {sublabel && (
        <div className="mt-1.5 text-xs text-muted">{sublabel}</div>
      )}
    </div>
  );
}

interface SimReadoutRowProps {
  children: ReactNode;
  className?: string;
}

/**
 * Lays `SimReadout` items in a responsive 2→4 column grid — a single quiet
 * strip, not a grid of nested cards.
 *
 * Uses a grid (not flex-wrap) so divider borders are never applied to the
 * first item of a wrapped row (the old flex border-l bug).
 */
export function SimReadoutRow({ children, className = "" }: SimReadoutRowProps) {
  return (
    <div
      className={`grid grid-cols-2 gap-6 md:grid-cols-4 ${className}`}
    >
      {children}
    </div>
  );
}
