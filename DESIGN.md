# Design

Visual system for the personal site. Captures the tokens and conventions actually shipped
in the landing hero (`app/`, `components/`, `lib/`). Two first-class themes; all colors in
OKLCH. Tokens live in `app/globals.css` (CSS vars) and are mapped to Tailwind in
`tailwind.config.ts`. The canvas renderer mirrors them as literal RGBA in
`components/hero/EquilibriumField.tsx` (`THEME_COLORS`) — keep the two in sync.

## Color

Theme is switched via `data-theme` on `<html>` (managed by `components/theme/ThemeProvider`).

### Phosphor (night — default)
A near-black scientific "lab" world; cool, calm, oscilloscope energy.

| Role | OKLCH | Use |
|---|---|---|
| `--bg` | `oklch(0.16 0.012 250)` | page background |
| `--surface` | `oklch(0.21 0.015 250)` | raised surfaces (toggle) |
| `--ink` | `oklch(0.97 0.005 250)` | headings, display |
| `--body` | `oklch(0.78 0.02 230)` | body copy (≥4.5:1 on bg) |
| `--accent` | `oklch(0.82 0.13 180)` | teal: eyebrows, readouts, equilibrium line |
| `--agent` | `oklch(0.80 0.11 230)` | sky: simulation agents |
| `--glow` | `oklch(0.85 0.14 180)` | settled-agent halo |

### Ledger (day)
A warm off-white "daylight workshop" world. Deliberately NOT cream-default: a committed
deep-teal ink with an ochre glow.

| Role | OKLCH | Use |
|---|---|---|
| `--bg` | `oklch(0.95 0.012 95)` | page background |
| `--surface` | `oklch(0.91 0.014 95)` | raised surfaces |
| `--ink` | `oklch(0.22 0.01 60)` | headings, display |
| `--body` | `oklch(0.38 0.02 60)` | body copy (≥4.5:1 on bg) |
| `--accent` | `oklch(0.46 0.07 200)` | deep teal: eyebrows, readouts, line, agents |
| `--glow` | `oklch(0.70 0.14 75)` | ochre: settled-agent halo |

**Strategy:** Committed dark / committed bright — color carries the brand. Accent is teal
in both worlds; the day world adds ochre warmth via glow, not via a warm-tinted background.

## Typography

Three-family system, loaded via `next/font/google` (self-hosted, no layout shift). All
chosen to avoid reflex-default fonts.

- **Display** — Bricolage Grotesque (`--font-display`, Tailwind `font-display`). Name, beat
  headlines. Weight 800; `tracking-[-0.03em]` to `-0.035em`; `text-wrap: balance`.
- **Body** — Geist (`--font-body`, `font-body`). Taglines, prose. Regular weight,
  `leading-relaxed`, `text-pretty`, max width ~42ch.
- **Mono (scoped)** — Spline Sans Mono (`--font-mono`, `font-mono`). ONLY numeric/data
  readouts (e.g. `price → equilibrium · drag to shock`) and short uppercase eyebrows.
  Never body copy.

Hero display clamp: `clamp(2.5rem, 8vw, 6rem)` (ceiling ≤ 6rem). Beat headings:
`clamp(2rem, 5.5vw, 3.75rem)`.

## Layout

- Full-viewport sections (`min-h-screen`), horizontal padding `px-[8vw]`.
- Persistent fixed canvas at `z-0`; content in `main` at `z-10`; theme toggle fixed at
  `z-50` top-right.
- Copy that overlaps the canvas uses the `.copy-scrim` utility (a radial vignette of the
  bg behind text) for legibility — not a card, not glass.
- Mobile-first; agent count and effects tier down by viewport width in `EquilibriumField`.

## Components

- `components/hero/EquilibriumField.tsx` — `"use client"` canvas renderer; thin loop over
  the pure engine in `lib/hero/fieldEngine.ts`. Reads scroll progress + pointer from refs;
  no per-frame React render.
- `components/hero/Beat.tsx` — one narrative beat (eyebrow + display heading + body +
  optional mono readout). framer-motion reveal, reduced-motion-safe.
- `components/hero/LandingNav.tsx` — semantic `<footer>`/`<nav>` landing zone.
- `components/theme/ThemeProvider.tsx` + `ThemeToggle.tsx` — theme state, persistence,
  `prefers-color-scheme`.
- `components/ui/*` (button, card) — shadcn primitives used by the article simulators.

## Motion

- Scroll drives a single 0→1 progress (`lib/hero/scrollProgress.ts`) that morphs the
  simulation chaos → equilibrium → network. Reverses on scroll-up.
- Cursor gravity always live; pointer-down injects a price shock (`applyShock`).
- Reveals ease-out-expo (`cubic-bezier(0.16, 1, 0.3, 1)`), no bounce/elastic.
- `prefers-reduced-motion`: simulation freezes to a static settled frame; copy crossfades.

## Testing & gates

- Pure logic (`fieldEngine`, `scrollProgress`, `resolveTheme`) is unit-tested (Vitest).
- Behavior is Playwright-tested (`tests/e2e/landing.spec.ts`).
- Completion gate: `node evals/judge.mjs --all` must return `done`. Deterministic gates
  (typecheck, build, unit, e2e) are in `evals/checks.json`.
