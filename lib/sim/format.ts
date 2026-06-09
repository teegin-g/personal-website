import * as d3 from "d3";

/**
 * Format a ratio as a percentage string.
 * Returns "--" for non-finite values.
 */
export function formatPct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "--";
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * Format a number as a dollar amount.
 * Returns "--" for non-finite values.
 */
export function formatMoney(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "--";
  return `$${value.toFixed(digits)}`;
}

/**
 * Format a number using d3's SI-prefix compact notation.
 * Replaces "G" (giga) with "B" (billions) to match common usage.
 * Returns "--" for non-finite values.
 */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "--";
  return d3.format("~s")(value).replace("G", "B");
}

/**
 * Return a tone class based on whether a delta is non-negative ("positive")
 * or negative ("danger").
 */
export function deltaTone(value: number): "positive" | "danger" {
  return value >= 0 ? "positive" : "danger";
}
