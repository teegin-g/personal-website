"use client";

import type {
  ButtonHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

type ButtonVariant = "solid" | "outline" | "ghost";

interface SimButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  /** Button label and any leading icon (place the icon first in children). */
  children: ReactNode;
  className?: string;
}

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel disabled:cursor-not-allowed disabled:opacity-50";

const buttonVariants: Record<ButtonVariant, string> = {
  solid: "bg-accent text-bg hover:opacity-90",
  outline: "border border-accent/40 text-ink hover:border-accent",
  ghost: "text-muted hover:text-ink",
};

/**
 * Themed action button. `solid` (default) is the accent CTA, `outline` is a
 * bordered secondary, `ghost` is a borderless tertiary. Pass an icon element
 * as the first child for a leading icon.
 */
export function SimButton({
  variant = "solid",
  children,
  className = "",
  type = "button",
  ...rest
}: SimButtonProps) {
  return (
    <button
      type={type}
      className={`${buttonBase} ${buttonVariants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

interface SimSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  children: ReactNode;
  className?: string;
}

/**
 * Themed native `<select>`. Renders on `surface` with a hairline border and a
 * pill shape; pass `<option>`s as children plus `value`/`onChange`.
 */
export function SimSelect({ children, className = "", ...rest }: SimSelectProps) {
  return (
    <select
      className={`rounded-full border border-grid-line bg-surface px-3 py-2 text-sm font-medium text-ink outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

interface SimTabsProps {
  /** ARIA group label for the pill cluster. */
  label?: string;
  children: ReactNode;
  className?: string;
}

/**
 * A pill group container for `SimToggleButton`s. Wraps them in a recessed
 * `surface` track so the active pill reads as raised.
 *
 * Uses `role="group"` (a segmented control, not a tab panel system — there are
 * no aria-controls / tabpanel pairings). Pass `label` as a human-readable
 * group name rendered via `aria-label`.
 */
export function SimTabs({ label, children, className = "" }: SimTabsProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded-full border border-grid-line bg-surface p-1 ${className}`}
    >
      {children}
    </div>
  );
}

interface SimToggleButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  active: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * A single pill in a `SimTabs` group. Active = accent fill on `bg` ink;
 * inactive = muted text that resolves to ink on hover.
 *
 * Uses `aria-pressed` (segmented toggle button), not `role="tab"` which would
 * require unpaired `aria-controls` / `tabpanel` siblings.
 */
export function SimToggleButton({
  active,
  children,
  className = "",
  type = "button",
  ...rest
}: SimToggleButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
        active ? "bg-accent text-bg" : "text-muted hover:text-ink"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
