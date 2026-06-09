"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  /** Optional kicker. Kept rare on purpose: mono is an instrument readout,
      not a per-section eyebrow. */
  eyebrow?: string;
  heading: string;
  children: ReactNode;
  /** Optional mono data readout shown under the copy. */
  readout?: string;
  align?: "center" | "end";
}

export function Beat({
  eyebrow,
  heading,
  children,
  readout,
  align = "center",
}: Props) {
  const reduce = useReducedMotion();
  const initial = reduce ? { opacity: 0 } : { opacity: 0, y: 28 };
  const whileInView = reduce ? { opacity: 1 } : { opacity: 1, y: 0 };

  return (
    <section
      className={`flex min-h-screen flex-col justify-center px-[8vw] ${
        align === "end" ? "items-start pb-[12vh]" : ""
      }`}
    >
      <motion.div
        initial={initial}
        whileInView={whileInView}
        viewport={{ once: false, amount: 0.5 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="copy-scrim max-w-2xl"
      >
        {eyebrow && (
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-accent">
            {eyebrow}
          </p>
        )}
        <h2 className="text-balance font-display text-[clamp(2rem,5.5vw,3.75rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-ink">
          {heading}
        </h2>
        <div className="mt-5 max-w-[42ch] text-pretty text-lg leading-relaxed text-body">
          {children}
        </div>
        {readout && (
          <p className="mt-6 font-mono text-sm tracking-wide text-accent">
            {readout}
          </p>
        )}
      </motion.div>
    </section>
  );
}
