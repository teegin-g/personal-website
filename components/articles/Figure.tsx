"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  /** Optional caption rendered in a <figcaption> below the content. */
  caption?: ReactNode;
  /** When true, the figure escapes the reading measure to a wide instrument area. */
  bleed?: boolean;
  /** Optional mono data label shown above the caption (e.g. "FIGURE 1"). */
  label?: string;
}

/**
 * Sets the global `--vw` custom property to the documentElement client width,
 * which EXCLUDES the scrollbar. The `.article-bleed` utility uses this to break
 * out to the viewport edges without ever introducing a horizontal scrollbar
 * (plain `100vw` would include the scrollbar gutter and overflow by ~15px).
 */
function useViewportWidthVar(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const set = () => {
      document.documentElement.style.setProperty(
        "--vw",
        `${document.documentElement.clientWidth}px`,
      );
    };
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, [enabled]);
}

export function Figure({ children, caption, bleed = false, label }: Props) {
  const reduce = useReducedMotion();
  useViewportWidthVar(bleed);

  // Reduced-motion: render fully visible immediately — no opacity gate, no animation.
  // Normal motion: animate on mount (not whileInView) so the figure unconditionally
  // resolves to opacity:1/y:0. A whileInView reveal can permanently stay at initial
  // values in headless renderers or background tabs where the IntersectionObserver
  // never fires; animate always fires.
  if (reduce) {
    return (
      <figure className={cn("my-12", bleed && "article-bleed")}>
        <div
          className={cn(
            bleed && "mx-auto w-full max-w-[1400px] px-[max(1.5rem,5vw)]",
          )}
        >
          {children}
          {(caption || label) && (
            <figcaption className="mx-auto mt-4 max-w-[68ch]">
              {label && (
                <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-accent">
                  {label}
                </span>
              )}
              {caption && (
                <span className="block text-pretty text-sm leading-6 text-muted">
                  {caption}
                </span>
              )}
            </figcaption>
          )}
        </div>
      </figure>
    );
  }

  return (
    <motion.figure
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={cn("my-12", bleed && "article-bleed")}
    >
      <div
        className={cn(
          bleed && "mx-auto w-full max-w-[1400px] px-[max(1.5rem,5vw)]",
        )}
      >
        {children}
        {(caption || label) && (
          <figcaption className="mx-auto mt-4 max-w-[68ch]">
            {label && (
              <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-accent">
                {label}
              </span>
            )}
            {caption && (
              <span className="block text-pretty text-sm leading-6 text-muted">
                {caption}
              </span>
            )}
          </figcaption>
        )}
      </div>
    </motion.figure>
  );
}
