"use client";

import { useEffect, useRef } from "react";
import { EquilibriumField } from "@/components/hero/EquilibriumField";
import { Beat } from "@/components/hero/Beat";
import { LandingNav } from "@/components/hero/LandingNav";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { scrollToProgress } from "@/lib/hero/scrollProgress";

export default function Home() {
  const progressRef = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      progressRef.current = scrollToProgress(
        window.scrollY,
        document.documentElement.scrollHeight,
        window.innerHeight,
      );
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <ThemeToggle />
      <EquilibriumField progressRef={progressRef} />
      <main className="relative z-10">
        {/* Beat 1 — arrival / who */}
        <section className="flex min-h-screen flex-col justify-center px-[8vw]">
          <div className="copy-scrim max-w-3xl">
            <p className="mb-5 font-mono text-xs uppercase tracking-[0.22em] text-accent">
              Exploration · Systems · Motion
            </p>
            <h1 className="text-balance font-display text-[clamp(2.5rem,8vw,6rem)] font-extrabold leading-[0.92] tracking-[-0.035em] text-ink">
              Teegin Groves
            </h1>
            <p className="mt-6 max-w-[42ch] text-pretty text-xl leading-relaxed text-body">
              I build things that make complex systems feel intuitive. Move your
              cursor through the field, then scroll.
            </p>
          </div>
        </section>

        {/* Beat 2 — equilibrium / what */}
        <Beat
          eyebrow="What I do"
          heading="Markets find their level. I make that visible."
          readout="price → equilibrium · drag to shock"
        >
          Most of my work turns messy economic behavior into something you can
          poke at and understand. Drag the field and watch it re-settle.
        </Beat>

        {/* Beat 3 — network / emergence */}
        <Beat
          eyebrow="How it connects"
          heading="Order isn't imposed. It emerges."
          align="end"
        >
          Out of independent decisions, structure appears. That's the thread
          running through everything here.
        </Beat>

        <LandingNav />
      </main>
    </>
  );
}
