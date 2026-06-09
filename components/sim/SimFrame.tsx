import type { ReactNode } from "react";

interface SimFrameProps {
  /** Instrument title, rendered in the display face. */
  title?: string;
  /** Mono eyebrow above the title (Beat eyebrow style). */
  eyebrow?: string;
  /** Right-aligned controls in the header (Reset, mode toggles, select). */
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * The instrument panel that wraps a simulator. Fills its container (never
 * `min-h-screen`) and renders an intentional, theme-native surface in both
 * phosphor and ledger: a `panel` field on a hairline `grid-line` border.
 *
 * The optional header lays out an eyebrow + title on the left and the
 * `toolbar` slot on the right.
 */
export function SimFrame({
  title,
  eyebrow,
  toolbar,
  children,
  className = "",
}: SimFrameProps) {
  const hasHeader = Boolean(eyebrow || title || toolbar);

  return (
    <div
      className={`rounded-3xl border border-grid-line bg-panel p-5 sm:p-6 ${className}`}
    >
      {hasHeader && (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-1.5 font-mono text-xs uppercase tracking-[0.22em] text-accent">
                {eyebrow}
              </p>
            )}
            {title && (
              <h3 className="font-display text-xl font-semibold leading-tight tracking-[-0.01em] text-ink sm:text-2xl">
                {title}
              </h3>
            )}
          </div>
          {toolbar && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {toolbar}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
