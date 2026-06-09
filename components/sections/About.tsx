"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

export function About() {
  const reduce = useReducedMotion();
  const initial = reduce ? { opacity: 0 } : { opacity: 0, y: 28 };
  const whileInView = reduce ? { opacity: 1 } : { opacity: 1, y: 0 };
  const portraitInitial = reduce ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.98 };
  const portraitInView = reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 };

  return (
    <section className="flex min-h-screen flex-col justify-center px-[8vw]">
      <div className="flex flex-col items-center gap-12 sm:flex-row sm:items-center sm:justify-between sm:gap-[6vw]">
        <motion.div
          initial={portraitInitial}
          whileInView={portraitInView}
          viewport={{ once: false, amount: 0.5 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0"
        >
          <Image
            src="/teegin.jpg"
            width={360}
            height={480}
            alt="Teegin Groves"
            priority={false}
            className="h-auto w-[clamp(13rem,26vw,22rem)] rounded-[1.75rem] object-cover shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)]"
          />
        </motion.div>

        <motion.div
          initial={initial}
          whileInView={whileInView}
          viewport={{ once: false, amount: 0.5 }}
          transition={{ duration: 0.8, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="copy-scrim max-w-xl"
        >
          <h2 className="text-balance font-display text-[clamp(2rem,5.5vw,3.75rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-ink">
            Hi, I&rsquo;m Teegin.
          </h2>
          <div className="mt-5 max-w-[44ch] space-y-4 text-pretty text-lg leading-relaxed text-body">
            <p>
              I&rsquo;m 24 and I write about whatever I find interesting. This
              whole site is mostly an excuse to make you subscribe to my{" "}
              <a
                href="https://substack.com/@economos"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-accent underline decoration-accent/40 decoration-2 underline-offset-4 transition-colors hover:decoration-accent"
              >
                Substack
              </a>
              .
            </p>
            <p>
              Some weeks that&rsquo;s markets and the weird ways systems settle.
              Some weeks it&rsquo;s a thing I built at 2am. No theme, no plan,
              just stuff I couldn&rsquo;t stop thinking about.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
