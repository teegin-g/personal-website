"use client";

import { useEffect, useRef, useState } from "react";
import { EquilibriumSurface } from "@/components/hero/EquilibriumSurface";

const CANVAS_KEY = "tg-index-canvas";

/** Settled value: sits the surface in its equilibrium state (valleys bloomed,
 *  links faintly emerging), so the backdrop reads as a quiet living relief
 *  rather than the hero's full scroll narrative. */
const CALM_PROGRESS = 0.62;

function isOn(stored: string | null): boolean {
  // Default ON: anything other than an explicit "off" keeps the canvas alive.
  return stored !== "off";
}

/**
 * Calm canvas backdrop for the articles index plus a persisted on/off toggle.
 *
 * The index does not scroll-narrate, so we feed EquilibriumSurface a fixed
 * progress ref pinned at its settled value (never wired to scroll). Pointer
 * interaction stays live inside the surface, giving a gently alive backdrop.
 *
 * When OFF, EquilibriumSurface is unmounted entirely, so its effect cleanup
 * cancels the rAF loop and removes its listeners. The page background (`bg`)
 * shows through as a quiet static backdrop. The preference persists in
 * localStorage and is resolved in an effect to stay hydration-safe.
 */
export function IndexCanvas() {
  // Render ON on the server / first client paint (the documented default),
  // then reconcile with the stored preference in an effect.
  const [enabled, setEnabled] = useState(true);
  const progressRef = useRef(CALM_PROGRESS);

  useEffect(() => {
    setEnabled(isOn(window.localStorage.getItem(CANVAS_KEY)));
  }, []);

  const toggle = () => {
    setEnabled((on) => {
      const next = !on;
      window.localStorage.setItem(CANVAS_KEY, next ? "on" : "off");
      return next;
    });
  };

  return (
    <>
      {enabled && (
        <div aria-hidden="true">
          <EquilibriumSurface progressRef={progressRef} />
        </div>
      )}
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        aria-label={enabled ? "Disable field background" : "Enable field background"}
        className="fixed left-5 top-5 z-50 rounded-full border border-accent/40 bg-surface/60 px-4 py-2 font-mono text-xs tracking-wide text-ink backdrop-blur transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {enabled ? "field on" : "field off"}
      </button>
    </>
  );
}
