"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import {
  applyShock,
  computeLinks,
  createField,
  equilibriumY,
  stepField,
  type Field,
  type Pointer,
} from "@/lib/hero/fieldEngine";
import { useTheme } from "@/components/theme/ThemeProvider";

// Literal colors matching globals.css token table (canvas can't read CSS vars per-frame).
const THEME_COLORS = {
  phosphor: { agent: "125,211,252", line: "94,234,212", glow: "94,234,212" },
  ledger: { agent: "13,92,99", line: "13,92,99", glow: "202,138,4" },
} as const;

interface Props {
  /** Ref the parent updates each scroll; read inside the rAF loop. */
  progressRef: MutableRefObject<number>;
}

export function EquilibriumField({ progressRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const agentCount = (w: number) => (w < 640 ? 36 : w < 1024 ? 52 : 70);
    let field: Field = createField({
      count: agentCount(window.innerWidth),
      width: window.innerWidth,
      height: window.innerHeight,
      seed: 7,
    });
    const pointer: { current: Pointer | null } = { current: null };
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      field = createField({ count: agentCount(w), width: w, height: h, seed: 7 });
    };
    resize();

    const onMove = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      pointer.current = null;
    };
    const onDown = (e: PointerEvent) => {
      applyShock(field, { x: e.clientX, y: e.clientY, strength: 260 });
    };

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const c = THEME_COLORS[themeRef.current];
      const progress = progressRef.current;

      ctx.clearRect(0, 0, w, h);

      // equilibrium line
      const eqY = equilibriumY(field);
      ctx.strokeStyle = `rgba(${c.line},0.28)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(0, eqY);
      ctx.lineTo(w, eqY);
      ctx.stroke();
      ctx.setLineDash([]);

      // network links emerge with progress
      if (progress > 0.6) {
        const links = computeLinks(field, 96);
        const alpha = (progress - 0.6) / 0.4;
        for (const [i, j] of links) {
          const a = field.agents[i];
          const b = field.agents[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          ctx.strokeStyle = `rgba(${c.line},${alpha * (1 - d / 96) * 0.5})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // agents
      for (const a of field.agents) {
        const settled = Math.max(0, 1 - Math.abs(a.y - eqY) / 140);
        ctx.fillStyle = `rgba(${c.agent},${0.45 + settled * 0.5})`;
        ctx.beginPath();
        ctx.arc(a.x, a.y, 2.1, 0, Math.PI * 2);
        ctx.fill();
        if (settled > 0.6) {
          ctx.strokeStyle = `rgba(${c.glow},${settled * 0.5})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(a.x, a.y, 2.1 + settled * 2.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    };

    const loop = () => {
      stepField(field, {
        dt: 1,
        progress: progressRef.current,
        pointer: pointer.current,
      });
      draw();
      raf = requestAnimationFrame(loop);
    };

    if (reduce) {
      // Static settled frame: run engine headless to equilibrium, draw once.
      for (let i = 0; i < 220; i++)
        stepField(field, { dt: 1, progress: 0.7, pointer: null });
      draw();
    } else {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerleave", onLeave);
      window.addEventListener("pointerdown", onDown);
      raf = requestAnimationFrame(loop);
    }

    const onVisibility = () => {
      if (reduce) return;
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        raf = requestAnimationFrame(loop);
      }
    };
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [progressRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 -z-10 h-screen w-screen"
    />
  );
}
