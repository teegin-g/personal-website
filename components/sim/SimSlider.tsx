"use client";

import { useId } from "react";

type ComparisonProps =
  | {
      /** When set with `comparisonValue`, renders a two-cell User | comparison chip. */
      comparisonLabel: string;
      /** Pre-formatted comparison string (e.g. the market average). */
      comparisonValue: string;
    }
  | {
      comparisonLabel?: never;
      comparisonValue?: never;
    };

type SimSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Appended to the displayed value (e.g. "%"). */
  suffix?: string;
  /** Prepended to the displayed value (e.g. "$"). */
  prefix?: string;
  /** Secondary helper text under the label. */
  hint?: string;
} & ComparisonProps;

/**
 * A themed range control: label (+ optional hint) on the left, a value chip on
 * the right, and an accent-tinted slider below. With `comparisonLabel` +
 * `comparisonValue`, the chip becomes a two-cell "User | comparison" readout.
 *
 * The displayed value mirrors the source sim: up to 2 fraction digits when
 * `step < 1`, otherwise 0, wrapped in `prefix`/`suffix`.
 */
export function SimSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix = "",
  prefix = "",
  hint,
  comparisonLabel,
  comparisonValue,
}: SimSliderProps) {
  const id = useId();
  const displayValue = `${prefix}${Number(value).toLocaleString(undefined, {
    maximumFractionDigits: step < 1 ? 2 : 0,
  })}${suffix}`;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <label
            htmlFor={id}
            className="block text-sm font-medium text-ink"
          >
            {label}
          </label>
          {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
        </div>

        {comparisonLabel ? (
          <div className="grid min-w-[150px] grid-cols-2 overflow-hidden rounded-2xl border border-grid-line bg-surface text-center">
            <div className="border-r border-grid-line px-2 py-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                User
              </div>
              <div className="text-sm font-semibold tabular-nums text-ink">
                {displayValue}
              </div>
            </div>
            <div className="px-2 py-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                {comparisonLabel}
              </div>
              <div className="text-sm font-semibold tabular-nums text-ink">
                {comparisonValue}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-full bg-surface px-3 py-1 text-sm font-semibold tabular-nums text-ink">
            {displayValue}
          </div>
        )}
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
      />
    </div>
  );
}
