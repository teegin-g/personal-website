"use client";

import { motion, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ComponentType } from "react";
import { useEffect, useRef, useState } from "react";

/*
 * Work: "what I've made".
 *
 * Layout intent: the Market Structure essay is the lead and is visually
 * dominant. Below it sit four LIVE simulator previews in a deliberately
 * asymmetric arrangement (not an identical icon-card grid). A final
 * "Projects" entry reads as not-yet-available with no link.
 *
 * Perf: the four simulators pull d3 / recharts / lucide and would bloat first
 * paint, so each is lazy-loaded with next/dynamic({ ssr:false }) and only
 * MOUNTED once its frame scrolls into view (IntersectionObserver). Until then
 * a muted, themed bg-surface placeholder of the same size holds the space.
 *
 * The live sims author their own light, full-page layouts, so each preview is
 * shown inside a fixed-height, clipped "viewport window" rather than letting an
 * alien full-page app take over. The window is honest: it is the real, running
 * component, just framed.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

// Lazy module loaders. Kept as thunks so next/dynamic does the code-splitting
// and nothing here lands in the first-paint bundle.
const lazySims = {
  network: () =>
    dynamic(() => import("@/components/visuals/NetworkProductionMarketSimulator"), {
      ssr: false,
    }),
  stigler: () =>
    dynamic(() => import("@/components/visuals/StiglerBarrierMarketSimulator"), {
      ssr: false,
    }),
  copyability: () =>
    dynamic(() => import("@/components/visuals/SupplySideCopyabilitySimulator"), {
      ssr: false,
    }),
  entry: () =>
    dynamic(() => import("@/components/visuals/EntryBarrierMarketDynamics"), {
      ssr: false,
    }),
} as const;

type SimKey = keyof typeof lazySims;

interface SimMeta {
  key: SimKey;
  index: string;
  title: string;
  blurb: string;
  /** Tailwind height class for the framed preview window. */
  frameHeight: string;
  /** Lets some tiles run wider for an asymmetric rhythm. */
  span: string;
}

const sims: SimMeta[] = [
  {
    key: "network",
    index: "01",
    title: "Network production simulator",
    blurb:
      "Spin up a few dozen firms, turn the network-effects dial, and watch one of them quietly eat everyone else.",
    frameHeight: "h-[26rem]",
    span: "lg:col-span-7",
  },
  {
    key: "stigler",
    index: "02",
    title: "Stigler barrier market",
    blurb:
      "Stigler's old point, made pokeable: who actually clears the bar to enter, and who never bothers.",
    frameHeight: "h-[26rem]",
    span: "lg:col-span-5",
  },
  {
    key: "copyability",
    index: "03",
    title: "Supply-side copyability",
    blurb:
      "How fast can a rival just copy your thing? Slide the imitation speed and see the moat fill or drain.",
    frameHeight: "h-[24rem]",
    span: "lg:col-span-5",
  },
  {
    key: "entry",
    index: "04",
    title: "Entry barrier dynamics",
    blurb:
      "Big prize, tall fence. Tune the profit pool against the cost of getting in and see who shows up.",
    frameHeight: "h-[24rem]",
    span: "lg:col-span-7",
  },
];

/**
 * Mounts a single simulator only once its frame intersects the viewport, then
 * keeps it mounted. Before that it shows a themed, sized placeholder so the
 * heavy chart libraries never touch first paint.
 */
function SimPreview({ meta, reduce }: { meta: SimMeta; reduce: boolean }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [Sim, setSim] = useState<ComponentType | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      // Very old / non-DOM environment: just mount it.
      setActive(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActive(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (active && !Sim) {
      setSim(() => lazySims[meta.key]());
    }
  }, [active, Sim, meta.key]);

  const initial = reduce ? { opacity: 0 } : { opacity: 0, y: 24 };
  const whileInView = reduce ? { opacity: 1 } : { opacity: 1, y: 0 };

  return (
    <motion.figure
      initial={initial}
      whileInView={whileInView}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, ease: EASE }}
      className={`flex flex-col ${meta.span}`}
    >
      <div
        ref={frameRef}
        className={`relative ${meta.frameHeight} overflow-hidden rounded-2xl border border-ink/10 bg-surface`}
      >
        {/* small instrument-style index tag: a readout, not a section eyebrow */}
        <span className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-bg/70 px-2 py-0.5 font-mono text-[0.65rem] tracking-wide text-accent">
          {meta.index} · live
        </span>

        {Sim ? (
          // The live, running component. Clipped to the frame so its own
          // full-page layout reads as a windowed preview.
          <div className="absolute inset-0 overflow-auto">
            <Sim />
          </div>
        ) : (
          // Themed placeholder of the same size. No spinner, no chart libs.
          <div
            aria-hidden
            className="absolute inset-0 flex items-end p-5"
          >
            <div className="h-full w-full">
              <div className="flex h-full flex-col justify-end gap-2 opacity-60">
                <div className="h-2 w-1/3 rounded-full bg-ink/10" />
                <div className="h-2 w-2/3 rounded-full bg-ink/10" />
                <div className="h-2 w-1/2 rounded-full bg-ink/10" />
              </div>
            </div>
          </div>
        )}
      </div>

      <figcaption className="mt-4 max-w-[44ch]">
        <h3 className="text-balance font-display text-xl font-bold leading-tight tracking-[-0.02em] text-ink">
          {meta.title}
        </h3>
        <p className="mt-2 text-pretty leading-relaxed text-body">{meta.blurb}</p>
      </figcaption>
    </motion.figure>
  );
}

export function Work() {
  const reduce = !!useReducedMotion();
  const headInitial = reduce ? { opacity: 0 } : { opacity: 0, y: 28 };
  const headInView = reduce ? { opacity: 1 } : { opacity: 1, y: 0 };

  return (
    <section className="flex min-h-screen flex-col justify-center px-[8vw] py-[16vh]">
      {/* Section opener */}
      <motion.div
        initial={headInitial}
        whileInView={headInView}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="max-w-2xl"
      >
        <h2 className="text-balance font-display text-[clamp(2rem,5.5vw,3.75rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-ink">
          Stuff I've made
        </h2>
        <p className="mt-5 max-w-[46ch] text-pretty text-lg leading-relaxed text-body">
          Mostly little economics machines you can grab and break. A few are
          live right here on the page, so go ahead.
        </p>
      </motion.div>

      {/* FEATURED essay: the visually dominant lead */}
      <motion.div
        initial={headInitial}
        whileInView={headInView}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="mt-14"
      >
        <Link
          href="/articles/market-structure"
          className="group block rounded-3xl border border-ink/10 bg-surface/60 p-8 transition-colors hover:border-accent sm:p-12"
        >
          <span className="font-mono text-xs tracking-[0.18em] text-accent">
            featured essay
          </span>
          <h3 className="mt-4 text-balance font-display text-[clamp(1.75rem,4.5vw,3.25rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink transition-transform duration-300 ease-out group-hover:translate-x-2">
            What market structure actually is
          </h3>
          <p className="mt-4 max-w-[52ch] text-pretty text-lg leading-relaxed text-body">
            An interactive read on why some markets collapse into one winner and
            others stay a messy crowd. Drag the sliders, not just your eyes.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 font-display text-base font-semibold text-accent">
            Read it
            <span className="transition-transform duration-300 ease-out group-hover:translate-x-1">
              →
            </span>
          </span>
        </Link>
      </motion.div>

      {/* Four LIVE simulator previews: asymmetric, not an icon-card grid */}
      <div className="mt-16 grid grid-cols-1 gap-x-8 gap-y-14 lg:grid-cols-12">
        {sims.map((meta) => (
          <SimPreview key={meta.key} meta={meta} reduce={reduce} />
        ))}
      </div>

      {/* Projects: genuinely not-yet-available. No link, no 404. */}
      <motion.div
        initial={headInitial}
        whileInView={headInView}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="mt-20 flex flex-col gap-2 border-t border-ink/10 pt-8 sm:flex-row sm:items-baseline sm:justify-between"
      >
        <div className="flex items-baseline gap-4">
          <span className="font-display text-3xl font-bold text-ink/45">
            Projects
          </span>
          <span className="font-mono text-xs tracking-[0.18em] text-body/60">
            coming soon
          </span>
        </div>
        <p className="max-w-[40ch] text-pretty text-body/70">
          Bigger builds are in the oven. Check back, or just bug me about them.
        </p>
      </motion.div>
    </section>
  );
}
