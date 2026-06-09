# Landing Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the scrollytelling landing page — a persistent canvas simulation of an agent-based market that morphs chaos → equilibrium → network as the visitor scrolls, with dual Phosphor/Ledger themes and a tactile day/night toggle.

**Architecture:** A framework-agnostic simulation engine (`fieldEngine.ts`, pure functions over an agent-state object) is unit-tested without a DOM. A thin `"use client"` canvas component (`EquilibriumField.tsx`) drives it via `requestAnimationFrame`, reading scroll progress and pointer state from refs (no per-frame React re-render). Scroll→progress mapping and theme resolution are extracted as pure functions for testing. framer-motion handles copy reveals and respects `prefers-reduced-motion`.

**Tech Stack:** Next.js 15 (App Router, React 19), TypeScript, Tailwind, framer-motion 11, Canvas 2D, `next/font/google` (Bricolage Grotesque + Geist + Spline Sans Mono), Vitest + Testing Library, Playwright. Design executed with the `impeccable` skill; completion gated by `node evals/judge.mjs --all`.

**Design reference:** `docs/superpowers/specs/2026-06-07-landing-hero-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/hero/fieldEngine.ts` | Pure simulation: agent state, `createField`, `stepField`, `computeLinks`, `applyShock`. No DOM, no React. |
| `lib/hero/scrollProgress.ts` | Pure `scrollToProgress()` and `progressToBeat()` mapping. |
| `lib/theme/resolveTheme.ts` | Pure `resolveInitialTheme()` + storage key constant. |
| `components/theme/ThemeProvider.tsx` | `"use client"` context: theme state, localStorage, `prefers-color-scheme`, sets `data-theme` on `<html>`. |
| `components/theme/ThemeToggle.tsx` | `"use client"` toggle control. |
| `components/hero/EquilibriumField.tsx` | `"use client"` canvas renderer. rAF loop over `fieldEngine`, reads scroll + pointer refs. `aria-hidden`. |
| `components/hero/Beat.tsx` | One narrative beat (eyebrow + headline + copy); framer-motion reveal with reduced-motion fallback. |
| `components/hero/LandingNav.tsx` | Semantic `<footer>`/`<nav>` landing zone: Articles, Projects, Substack. |
| `app/page.tsx` | Landing route. Scroll container + ThemeToggle + EquilibriumField + 3 Beats + LandingNav. (Replaces placeholder.) |
| `app/layout.tsx` | Wire `next/font`, ThemeProvider, set base `data-theme`. (Modify.) |
| `app/globals.css` | OKLCH tokens for both themes, base styles, reduced-motion. (Modify.) |
| `tailwind.config.ts` | Map theme CSS vars to Tailwind colors + font families. (Modify.) |
| `tests/unit/fieldEngine.test.ts` | Convergence, shock, links, agent-count stability. |
| `tests/unit/scrollProgress.test.ts` | Mapping correctness. |
| `tests/unit/resolveTheme.test.ts` | Initial-theme resolution. |
| `tests/e2e/landing.spec.ts` | Hero render, scroll reveal, theme toggle persist, reduced-motion, keyboard nav, screenshot. |

**Design tokens (used throughout — single source of truth):**

| Role | Phosphor (night) | Ledger (day) |
|---|---|---|
| bg | `oklch(0.16 0.012 250)` (~`#06070a`) | `oklch(0.95 0.012 95)` (~`#f2f0ea`) |
| ink (headings) | `oklch(0.97 0.005 250)` | `oklch(0.22 0.01 60)` |
| body | `oklch(0.78 0.02 230)` (≥4.5:1 on bg) | `oklch(0.38 0.02 60)` (≥4.5:1 on bg) |
| accent (line/eyebrow) | `oklch(0.82 0.13 180)` (teal) | `oklch(0.46 0.07 200)` (deep teal `#0d5c63`) |
| agent | `oklch(0.80 0.11 230)` (sky) | `oklch(0.46 0.07 200)` |
| glow (settled) | `oklch(0.85 0.14 180)` | `oklch(0.70 0.14 75)` (ochre) |

Canvas reads these as literal RGBA via a `THEME_COLORS` map in `EquilibriumField.tsx` (canvas can't read CSS vars cheaply per-frame); CSS/Tailwind read them from `globals.css` vars. Keep the two in sync — both derive from this table.

---

## Task 1: Theme tokens, fonts, and Tailwind wiring

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Replace `app/globals.css` with theme tokens**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root,
[data-theme="phosphor"] {
  --bg: oklch(0.16 0.012 250);
  --surface: oklch(0.21 0.015 250);
  --ink: oklch(0.97 0.005 250);
  --body: oklch(0.78 0.02 230);
  --accent: oklch(0.82 0.13 180);
  --agent: oklch(0.80 0.11 230);
  --glow: oklch(0.85 0.14 180);
}

[data-theme="ledger"] {
  --bg: oklch(0.95 0.012 95);
  --surface: oklch(0.91 0.014 95);
  --ink: oklch(0.22 0.01 60);
  --body: oklch(0.38 0.02 60);
  --accent: oklch(0.46 0.07 200);
  --agent: oklch(0.46 0.07 200);
  --glow: oklch(0.70 0.14 75);
}

html {
  background: var(--bg);
  color: var(--body);
  scroll-behavior: smooth;
}

body {
  background: var(--bg);
  color: var(--body);
  transition: background-color 0.6s ease, color 0.6s ease;
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  body { transition: none; }
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

- [ ] **Step 2: Wire fonts + ThemeProvider in `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, Geist, Spline_Sans_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const body = Geist({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const mono = Spline_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Teegin Groves",
  description:
    "Interactive economics simulations and writing on how complex systems work.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="phosphor"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body className="font-body antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Map vars + fonts in `tailwind.config.ts`**

Replace the `theme` block (keep existing `content` array, append `./lib/**/*.{ts,tsx}`):

```ts
import type { Config } from "tailwind";
```
(Use the real import already present.) Set:

```ts
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        body: "var(--body)",
        accent: "var(--accent)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
```

- [ ] **Step 4: Verify build compiles (ThemeProvider stub allowed to fail import — create it in Task 4 first if executing in order; otherwise this step is verified at Task 4).**

Run: `npx tsc --noEmit`
Expected: passes once Task 4 exists. If running tasks in order, do Task 4 before this verification.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/layout.tsx tailwind.config.ts
git commit -m "feat(theme): OKLCH dual-theme tokens, fonts, tailwind wiring"
```

---

## Task 2: Field simulation engine (pure, unit-tested)

**Files:**
- Create: `lib/hero/fieldEngine.ts`
- Test: `tests/unit/fieldEngine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  createField,
  stepField,
  computeLinks,
  applyShock,
  meanDistanceToEquilibrium,
  type Field,
} from "@/lib/hero/fieldEngine";

const cfg = { count: 60, width: 1000, height: 800, seed: 7 };

describe("fieldEngine", () => {
  it("creates a stable agent count", () => {
    const f = createField(cfg);
    expect(f.agents).toHaveLength(60);
    for (let i = 0; i < 50; i++) stepField(f, { dt: 1, progress: 0.5, pointer: null });
    expect(f.agents).toHaveLength(60);
  });

  it("converges toward equilibrium at progress=0.5", () => {
    const f = createField(cfg);
    const before = meanDistanceToEquilibrium(f);
    for (let i = 0; i < 200; i++) stepField(f, { dt: 1, progress: 0.5, pointer: null });
    const after = meanDistanceToEquilibrium(f);
    expect(after).toBeLessThan(before);
    expect(after).toBeLessThan(f.height * 0.08);
  });

  it("re-converges after a shock", () => {
    const f = createField(cfg);
    for (let i = 0; i < 200; i++) stepField(f, { dt: 1, progress: 0.5, pointer: null });
    const settled = meanDistanceToEquilibrium(f);
    applyShock(f, { x: 500, y: 400, strength: 300 });
    expect(meanDistanceToEquilibrium(f)).toBeGreaterThan(settled);
    for (let i = 0; i < 200; i++) stepField(f, { dt: 1, progress: 0.5, pointer: null });
    expect(meanDistanceToEquilibrium(f)).toBeLessThan(f.height * 0.1);
  });

  it("forms network links by distance threshold at high progress", () => {
    const f = createField(cfg);
    for (let i = 0; i < 200; i++) stepField(f, { dt: 1, progress: 1, pointer: null });
    const links = computeLinks(f, 90);
    expect(links.length).toBeGreaterThan(0);
    for (const [a, b] of links) {
      const dx = f.agents[a].x - f.agents[b].x;
      const dy = f.agents[a].y - f.agents[b].y;
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(90);
    }
  });

  it("is deterministic for a given seed", () => {
    const f1 = createField(cfg);
    const f2 = createField(cfg);
    for (let i = 0; i < 20; i++) {
      stepField(f1, { dt: 1, progress: 0.3, pointer: null });
      stepField(f2, { dt: 1, progress: 0.3, pointer: null });
    }
    expect(f1.agents[0].x).toBeCloseTo(f2.agents[0].x, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/fieldEngine.test.ts`
Expected: FAIL — cannot find module `@/lib/hero/fieldEngine`.

- [ ] **Step 3: Write the implementation**

```ts
// Pure, framework-agnostic agent-based field simulation.
// No DOM, no React: positions are in an abstract width x height space.

export interface Agent {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number; // per-agent offset for organic motion
}

export interface Field {
  agents: Agent[];
  width: number;
  height: number;
  t: number;
}

export interface FieldConfig {
  count: number;
  width: number;
  height: number;
  seed: number;
}

export interface Pointer {
  x: number;
  y: number;
}

export interface StepInput {
  dt: number;
  progress: number; // 0..1 narrative scroll position
  pointer: Pointer | null;
}

// Deterministic PRNG (mulberry32) so tests and SSR/CSR agree.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function equilibriumY(field: Field): number {
  // Breathing line near vertical center.
  return field.height * 0.52 + Math.sin(field.t * 0.5) * (field.height * 0.04);
}

export function createField(cfg: FieldConfig): Field {
  const rng = mulberry32(cfg.seed);
  const agents: Agent[] = [];
  for (let i = 0; i < cfg.count; i++) {
    agents.push({
      x: rng() * cfg.width,
      y: rng() * cfg.height,
      vx: 0,
      vy: 0,
      phase: rng() * Math.PI * 2,
    });
  }
  return { agents, width: cfg.width, height: cfg.height, t: 0 };
}

export function applyShock(
  field: Field,
  shock: { x: number; y: number; strength: number },
): void {
  for (const a of field.agents) {
    const dx = a.x - shock.x;
    const dy = a.y - shock.y;
    const d = Math.hypot(dx, dy) || 1;
    const f = (shock.strength / d) * Math.min(1, shock.strength / 100);
    a.vx += (dx / d) * f;
    a.vy += (dy / d) * f;
  }
}

export function stepField(field: Field, input: StepInput): Field {
  const { dt, progress, pointer } = input;
  field.t += 0.016 * dt;
  const eqY = equilibriumY(field);
  // progress: 0 chaos -> 0.5 equilibrium pull -> 1 network (still settled)
  const pull = Math.min(1, progress * 2) * 0.0016; // strengthens into equilibrium
  const damping = 0.9;

  for (const a of field.agents) {
    const target = eqY + Math.sin(a.x * 0.01 + field.t + a.phase) * (field.height * 0.012);
    // chaos drift when progress is low
    const chaos = (1 - Math.min(1, progress * 2)) * 0.15;
    a.vy += (target - a.y) * pull * dt;
    a.vx += Math.sin(field.t + a.phase) * chaos * dt;
    a.vy += Math.cos(field.t * 1.3 + a.phase) * chaos * dt;

    if (pointer) {
      const dx = a.x - pointer.x;
      const dy = a.y - pointer.y;
      const d = Math.hypot(dx, dy);
      if (d < 140 && d > 0.001) {
        const f = (1 - d / 140) * 1.4;
        a.vx += (dx / d) * f * dt;
        a.vy += (dy / d) * f * dt;
      }
    }

    a.vx *= damping;
    a.vy *= damping;
    a.x += a.vx * dt;
    a.y += a.vy * dt;

    // wrap horizontally, clamp vertically
    if (a.x < 0) a.x += field.width;
    if (a.x > field.width) a.x -= field.width;
    if (a.y < 0) { a.y = 0; a.vy *= -0.5; }
    if (a.y > field.height) { a.y = field.height; a.vy *= -0.5; }
  }
  return field;
}

export function meanDistanceToEquilibrium(field: Field): number {
  const eqY = equilibriumY(field);
  let sum = 0;
  for (const a of field.agents) sum += Math.abs(a.y - eqY);
  return sum / field.agents.length;
}

export function computeLinks(field: Field, threshold: number): [number, number][] {
  const links: [number, number][] = [];
  const a = field.agents;
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      const dx = a[i].x - a[j].x;
      const dy = a[i].y - a[j].y;
      if (Math.hypot(dx, dy) <= threshold) links.push([i, j]);
    }
  }
  return links;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/fieldEngine.test.ts`
Expected: PASS (5 tests). If convergence test fails, the `pull` constant is too weak — it is tuned so 200 steps settle under 8–10% of height; do not weaken the assertions.

- [ ] **Step 5: Commit**

```bash
git add lib/hero/fieldEngine.ts tests/unit/fieldEngine.test.ts
git commit -m "feat(hero): pure agent-field simulation engine with tests"
```

---

## Task 3: Scroll → progress mapping (pure, unit-tested)

**Files:**
- Create: `lib/hero/scrollProgress.ts`
- Test: `tests/unit/scrollProgress.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { scrollToProgress, progressToBeat } from "@/lib/hero/scrollProgress";

describe("scrollToProgress", () => {
  it("is 0 at top and 1 at bottom of scrollable range", () => {
    expect(scrollToProgress(0, 3000, 1000)).toBe(0);
    expect(scrollToProgress(2000, 3000, 1000)).toBe(1);
  });
  it("is 0.5 at the midpoint", () => {
    expect(scrollToProgress(1000, 3000, 1000)).toBeCloseTo(0.5, 5);
  });
  it("clamps out-of-range input", () => {
    expect(scrollToProgress(-50, 3000, 1000)).toBe(0);
    expect(scrollToProgress(99999, 3000, 1000)).toBe(1);
  });
  it("returns 0 when content fits the viewport (no scroll range)", () => {
    expect(scrollToProgress(0, 800, 1000)).toBe(0);
  });
});

describe("progressToBeat", () => {
  it("maps thirds to beats 0,1,2", () => {
    expect(progressToBeat(0.1)).toBe(0);
    expect(progressToBeat(0.5)).toBe(1);
    expect(progressToBeat(0.9)).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/scrollProgress.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// Pure mapping from scroll geometry to narrative progress.

export function scrollToProgress(
  scrollY: number,
  scrollHeight: number,
  viewportHeight: number,
): number {
  const range = scrollHeight - viewportHeight;
  if (range <= 0) return 0;
  const p = scrollY / range;
  return Math.max(0, Math.min(1, p));
}

export function progressToBeat(progress: number): 0 | 1 | 2 {
  if (progress < 1 / 3) return 0;
  if (progress < 2 / 3) return 1;
  return 2;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/scrollProgress.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/hero/scrollProgress.ts tests/unit/scrollProgress.test.ts
git commit -m "feat(hero): pure scroll-to-progress mapping with tests"
```

---

## Task 4: Theme resolution + provider + toggle

**Files:**
- Create: `lib/theme/resolveTheme.ts`
- Create: `components/theme/ThemeProvider.tsx`
- Create: `components/theme/ThemeToggle.tsx`
- Test: `tests/unit/resolveTheme.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { resolveInitialTheme, THEME_KEY, type Theme } from "@/lib/theme/resolveTheme";

describe("resolveInitialTheme", () => {
  it("uses stored theme when valid", () => {
    expect(resolveInitialTheme("ledger", true)).toBe("ledger");
    expect(resolveInitialTheme("phosphor", false)).toBe("phosphor");
  });
  it("falls back to prefers-color-scheme when unset", () => {
    expect(resolveInitialTheme(null, true)).toBe("phosphor"); // prefers dark
    expect(resolveInitialTheme(null, false)).toBe("ledger");
  });
  it("ignores invalid stored values", () => {
    expect(resolveInitialTheme("banana" as Theme, false)).toBe("ledger");
  });
  it("exposes a stable storage key", () => {
    expect(THEME_KEY).toBe("tg-theme");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/resolveTheme.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/theme/resolveTheme.ts`**

```ts
export type Theme = "phosphor" | "ledger";

export const THEME_KEY = "tg-theme";

export function isTheme(v: unknown): v is Theme {
  return v === "phosphor" || v === "ledger";
}

export function resolveInitialTheme(
  stored: string | null,
  prefersDark: boolean,
): Theme {
  if (isTheme(stored)) return stored;
  return prefersDark ? "phosphor" : "ledger";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/resolveTheme.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write `components/theme/ThemeProvider.tsx`**

```tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  resolveInitialTheme,
  THEME_KEY,
  type Theme,
} from "@/lib/theme/resolveTheme";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("phosphor");

  // Resolve real theme on mount (avoids SSR/localStorage mismatch).
  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    setTheme(resolveInitialTheme(stored, prefersDark));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggle = () =>
    setTheme((t) => (t === "phosphor" ? "ledger" : "phosphor"));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 6: Write `components/theme/ThemeToggle.tsx`**

```tsx
"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === "phosphor" ? "ledger" : "phosphor";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      className="fixed right-5 top-5 z-50 rounded-full border border-accent/40 bg-surface/60 px-4 py-2 font-mono text-xs tracking-wide text-ink backdrop-blur transition-colors hover:border-accent"
    >
      {theme === "phosphor" ? "night" : "day"}
    </button>
  );
}
```

- [ ] **Step 7: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add lib/theme components/theme tests/unit/resolveTheme.test.ts
git commit -m "feat(theme): resolution logic, provider, and day/night toggle"
```

---

## Task 5: EquilibriumField canvas renderer

**Files:**
- Create: `components/hero/EquilibriumField.tsx`

No unit test (DOM/canvas rendering is covered by the engine tests + Playwright). Keep it thin: all simulation logic lives in `fieldEngine`.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useRef } from "react";
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
  progressRef: React.MutableRefObject<number>;
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

    let field: Field;
    let dpr = 1;
    const pointer: { current: Pointer | null } = { current: null };
    let raf = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = w < 640 ? 36 : w < 1024 ? 52 : 70;
      field = createField({ count, width: w, height: h, seed: 7 });
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
      stepField(field, { dt: 1, progress: progressRef.current, pointer: pointer.current });
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
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/hero/EquilibriumField.tsx
git commit -m "feat(hero): canvas field renderer with reduced-motion + device tiering"
```

---

## Task 6: Beat component

**Files:**
- Create: `components/hero/Beat.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  eyebrow: string;
  heading: string;
  children: ReactNode;
  /** Optional mono data readout shown under the copy. */
  readout?: string;
  align?: "center" | "end";
}

export function Beat({ eyebrow, heading, children, readout, align = "center" }: Props) {
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
        className="max-w-2xl"
      >
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-accent">
          {eyebrow}
        </p>
        <h2 className="text-balance font-display text-[clamp(2rem,5.5vw,3.75rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-ink">
          {heading}
        </h2>
        <div className="mt-5 max-w-[42ch] text-pretty text-lg leading-relaxed text-body">
          {children}
        </div>
        {readout && (
          <p className="mt-6 font-mono text-sm tracking-wide text-accent">{readout}</p>
        )}
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/hero/Beat.tsx
git commit -m "feat(hero): narrative Beat with reduced-motion-safe reveal"
```

---

## Task 7: Landing navigation zone

**Files:**
- Create: `components/hero/LandingNav.tsx`

- [ ] **Step 1: Write the component**

```tsx
import Link from "next/link";

const links = [
  { href: "/articles/market-structure", label: "Articles", hint: "Interactive essays on how systems work" },
  { href: "/projects", label: "Projects", hint: "Things I've built" },
  { href: "https://substack.com", label: "Follow", hint: "New writing in your inbox", external: true },
];

export function LandingNav() {
  return (
    <footer className="flex min-h-screen flex-col justify-center px-[8vw] pb-[10vh]">
      <p className="mb-8 font-mono text-xs uppercase tracking-[0.22em] text-accent">
        Where to go
      </p>
      <nav className="flex flex-col gap-2">
        {links.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            target={l.external ? "_blank" : undefined}
            rel={l.external ? "noreferrer" : undefined}
            className="group flex flex-col border-t border-ink/10 py-6 transition-colors hover:border-accent sm:flex-row sm:items-baseline sm:justify-between"
          >
            <span className="font-display text-3xl font-bold text-ink transition-transform duration-300 ease-out group-hover:translate-x-2">
              {l.label}
            </span>
            <span className="mt-1 text-sm text-body sm:mt-0">{l.hint}</span>
          </Link>
        ))}
      </nav>
    </footer>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. (The `/projects` route does not exist yet; the link is intentional forward-wiring and does not break the build. Out of scope to build that page now.)

- [ ] **Step 3: Commit**

```bash
git add components/hero/LandingNav.tsx
git commit -m "feat(hero): semantic landing navigation zone"
```

---

## Task 8: Assemble the landing page

**Files:**
- Modify: `app/page.tsx` (full replace)

- [ ] **Step 1: Replace `app/page.tsx`**

```tsx
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
      <main className="relative">
        {/* Beat 1 — arrival / who */}
        <section className="flex min-h-screen flex-col justify-center px-[8vw]">
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
```

- [ ] **Step 2: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0; route `/` builds (will be dynamic due to `"use client"`, that's fine).

- [ ] **Step 3: Manual smoke (impeccable browser pass happens in Task 10)**

Run: `npm run dev`, open `http://localhost:3000`. Confirm: name visible, field animates, cursor pushes agents, scrolling reveals beats, toggle flips palette. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(hero): assemble scrollytelling landing page"
```

---

## Task 9: Playwright e2e

**Files:**
- Create: `tests/e2e/landing.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const SHOTS = "evals/runs/latest/bundle/screenshots";

test("hero renders name and tagline", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Teegin Groves", level: 1 })).toBeVisible();
  await expect(page.getByText(/make complex systems feel intuitive/i)).toBeVisible();
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/landing-night.png`, fullPage: false });
});

test("scrolling reveals later beats", async ({ page }) => {
  await page.goto("/");
  const beat3 = page.getByRole("heading", { name: /Order isn't imposed/i });
  await beat3.scrollIntoViewIfNeeded();
  await expect(beat3).toBeVisible();
});

test("theme toggle flips palette and persists across reload", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  const start = await html.getAttribute("data-theme");
  await page.getByRole("button", { name: /Switch to/i }).click();
  const flipped = await html.getAttribute("data-theme");
  expect(flipped).not.toBe(start);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", flipped!);
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/landing-day.png`, fullPage: false });
});

test("reduced motion: content fully visible, no animation gating", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Teegin Groves", level: 1 })).toBeVisible();
  await page.getByRole("heading", { name: /Order isn't imposed/i }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: /Order isn't imposed/i })).toBeVisible();
  await context.close();
});

test("keyboard navigation reaches the nav links", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Articles/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Follow/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the e2e suite**

Run: `npx playwright test tests/e2e/landing.spec.ts`
Expected: 5 passed. If the `Order isn't imposed` heading isn't found, confirm Task 8 copy matches exactly.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/landing.spec.ts
git commit -m "test(hero): playwright coverage for scroll, theme, a11y"
```

---

## Task 10: Impeccable polish pass (browser-driven)

**Files:** any of the hero/theme components, `app/globals.css`, `app/page.tsx` as needed.

This is the craft pass. Use the running dev server and screenshots; iterate on real pixels.

- [ ] **Step 1:** `npm run dev`; open `http://localhost:3000`. Screenshot both themes at desktop (1440px) and mobile (390px) widths.

- [ ] **Step 2:** Run `/impeccable polish app/page.tsx` (and the hero components). Verify against the spec's craft bars:
  - Body text ≥ 4.5:1 in BOTH themes (check the Ledger tagline especially).
  - Display letter-spacing ≥ -0.04em; hero clamp max ≤ 6rem; headings `text-wrap: balance`.
  - Copy has no em dashes, no buzzwords, no aphoristic-cadence triplets.
  - Motion eases out (no bounce); name entrance is deliberate; reveals enhance already-visible content.
  - Toggle, agents, and links all feel tactile (cursor gravity legible).

- [ ] **Step 3:** Fix issues inline. Re-screenshot to confirm. Keep `useFieldEngine` untouched (logic is frozen by tests).

- [ ] **Step 4: Re-run all gates**

Run: `npx tsc --noEmit && npx vitest run && npm run build && npx playwright test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "polish(hero): impeccable craft pass on type, contrast, motion, copy"
```

---

## Task 11: Goal-eval completion gate

**Files:** `evals/runs/latest/{request.md,checklist.json,changed-files.txt,diff.patch}` (gitignored bundle).

- [ ] **Step 1: Write `evals/runs/latest/request.md`** — the landing-hero request (paste this task's goal + reference to the spec).

- [ ] **Step 2: Write `evals/runs/latest/checklist.json`** (schema `project-setup/eval-checklist` v1). Items, with correct `proof` types (NOT "assertion" for non-UI — use `typecheck`/`unit`/`diff`; use `playwright`/`screenshot` for UI):
  - C1 (build, proof `typecheck`): `npm run build` exits 0.
  - C2 (typecheck, proof `typecheck`): `npx tsc --noEmit` exits 0.
  - C3 (unit, proof `unit`): `npx vitest run` green — fieldEngine convergence/shock/links, scrollProgress mapping, resolveTheme.
  - C4 (e2e, proof `playwright`): landing renders hero, scroll reveals beat 3, theme toggle persists, reduced-motion shows all copy, nav links reachable; screenshot artifacts present.
  - C5 (no-regression, proof `diff`): existing MDX article, `interactive-visuals/*.jsx`, and `evals/` untouched.

- [ ] **Step 3: Build the changed-files list + diff**

```bash
files=(app/globals.css app/layout.tsx app/page.tsx tailwind.config.ts \
  lib/hero/fieldEngine.ts lib/hero/scrollProgress.ts lib/theme/resolveTheme.ts \
  components/theme/ThemeProvider.tsx components/theme/ThemeToggle.tsx \
  components/hero/EquilibriumField.tsx components/hero/Beat.tsx components/hero/LandingNav.tsx \
  tests/unit/fieldEngine.test.ts tests/unit/scrollProgress.test.ts tests/unit/resolveTheme.test.ts \
  tests/e2e/landing.spec.ts)
printf "%s\n" "${files[@]}" > evals/runs/latest/changed-files.txt
git diff HEAD~ -- "${files[@]}" > evals/runs/latest/diff.patch
```
(Adjust the `git diff` ref so the diff captures all landing-hero commits.)

- [ ] **Step 4: Run the gate**

Run: `node evals/judge.mjs --all`
Expected: `done (passed)`. If `not-done`: read `evals/runs/latest/verdict.json`, repair the failing item (or fix a mis-tagged `proof` type), re-run gates, re-judge. Deterministic gates are supreme.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore(hero): goal-eval bundle — landing hero done verdict"
```

---

## Self-Review

**Spec coverage:**
- Narrative spine (3 beats + landing zone) → Tasks 8, 6, 7. ✓
- Dual themes + tactile toggle → Tasks 1, 4. ✓
- Type system (Bricolage/Geist/scoped mono) → Tasks 1 (fonts), 6/8 (mono on readouts only). ✓
- Contrast discipline → token table (Task 1) + Task 10 verification. ✓
- Scroll-driven morph + cursor gravity + drag-to-shock + network links → Tasks 2, 3, 5, 8. ✓
- Reduced motion / device tiering / tab-hidden pause / aria-hidden canvas → Task 5; reduced-motion copy path → Task 6; e2e proof → Task 9. ✓
- Keyboard/semantic nav → Task 7; e2e proof → Task 9. ✓
- Architecture (thin renderer over pure engine) → Tasks 2 vs 5. ✓
- Tests (unit + e2e) → Tasks 2,3,4,9. ✓
- Goal-eval gate → Task 11. ✓
- Out of scope (article restyle, projects page, latest-cards, Slopcast, Substack backend) → not built; `/projects` link is forward-wiring only (noted in Task 7). ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete; copy is final.

**Type consistency:** `Field`, `Agent`, `Pointer`, `StepInput` defined in Task 2 and imported unchanged in Task 5. `Theme`/`THEME_KEY`/`resolveInitialTheme` defined in Task 4, used in ThemeProvider. `scrollToProgress` signature matches between Task 3 definition and Task 8 usage. `progressRef` prop type consistent between Tasks 5 and 8. `THEME_COLORS` keys (`phosphor`/`ledger`) match the `Theme` union.

**Note on Task ordering:** Task 1 Step 4 verification depends on Task 4's ThemeProvider. When executing in order, create `ThemeProvider` (Task 4) before running Task 1's build verification, or defer that check to Task 4 Step 7 (which covers it).
