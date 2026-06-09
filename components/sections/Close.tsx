"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

interface Destination {
  href: string;
  label: string;
  hint: string;
  external?: boolean;
  /** No href: renders as a static row, not a link. */
  comingSoon?: boolean;
}

const destinations: Destination[] = [
  {
    href: "/articles/market-structure",
    label: "Articles",
    hint: "Interactive essays on how systems actually work",
  },
  {
    label: "Projects",
    href: "",
    hint: "Cooking. Check back.",
    comingSoon: true,
  },
  {
    href: "https://substack.com/@economos",
    label: "Substack",
    hint: "New writing, straight to your inbox",
    external: true,
  },
  {
    href: "https://github.com/teegin-g",
    label: "GitHub",
    hint: "The code, warts and all",
    external: true,
  },
  {
    href: "https://www.linkedin.com/in/teegin-groves-3535a7200/",
    label: "LinkedIn",
    hint: "The professional-shaped version of me",
    external: true,
  },
];

const rowClass =
  "group flex flex-col border-t border-ink/10 py-6 sm:flex-row sm:items-baseline sm:justify-between";
const labelClass =
  "font-display text-3xl font-bold text-ink transition-transform duration-300 ease-out group-hover:translate-x-2";
const hintClass = "mt-1 text-sm text-body sm:mt-0";

export function Close() {
  const reduce = useReducedMotion();
  const initial = reduce ? { opacity: 0 } : { opacity: 0, y: 28 };
  const whileInView = reduce ? { opacity: 1 } : { opacity: 1, y: 0 };

  return (
    <footer className="flex min-h-screen flex-col justify-center px-[8vw] pb-[10vh]">
      <motion.div
        initial={initial}
        whileInView={whileInView}
        viewport={{ once: false, amount: 0.4 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="copy-scrim max-w-2xl"
      >
        <p className="mb-4 font-mono text-xs tracking-wide text-accent">
          // end of line
        </p>
        <h2 className="text-balance font-display text-[clamp(2rem,5.5vw,3.75rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-ink">
          That's the tour. Want to keep going?
        </h2>
        <p className="mt-5 max-w-[42ch] text-pretty text-lg leading-relaxed text-body">
          Read something, poke at the code, or just say hi. I answer email
          faster than I'd like to admit.
        </p>
        <a
          href="mailto:teegingroves@gmail.com"
          className="mt-7 inline-flex items-baseline gap-2 font-display text-2xl font-bold text-accent transition-transform duration-300 ease-out hover:translate-x-1"
        >
          teegingroves@gmail.com
          <span aria-hidden="true" className="font-mono text-base">
            -&gt;
          </span>
        </a>
      </motion.div>

      <motion.nav
        initial={initial}
        whileInView={whileInView}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ duration: 0.8, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        aria-label="Where to go next"
        className="mt-14 flex flex-col"
      >
        {destinations.map((d) =>
          d.comingSoon ? (
            <div
              key={d.label}
              className={`${rowClass} cursor-default`}
              aria-disabled="true"
            >
              <span className="flex items-baseline gap-3 font-display text-3xl font-bold text-body">
                {d.label}
                <span className="rounded-full border border-ink/10 px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-accent">
                  coming soon
                </span>
              </span>
              <span className={hintClass}>{d.hint}</span>
            </div>
          ) : (
            <Link
              key={d.label}
              href={d.href}
              target={d.external ? "_blank" : undefined}
              rel={d.external ? "noreferrer" : undefined}
              className={`${rowClass} transition-colors hover:border-accent`}
            >
              <span className={labelClass}>{d.label}</span>
              <span className={hintClass}>{d.hint}</span>
            </Link>
          ),
        )}
      </motion.nav>
    </footer>
  );
}
