# Landing Hero — Design Spec

**Date:** 2026-06-07
**Status:** Approved (brainstorming complete; ready for implementation plan)
**Surface:** Landing page (`/`) — the site's front door
**Register:** Brand (design IS the product)

## Context

Teegin Groves is a quantitative economics/math analyst (BD at Continental
Resources) who builds interactive economics simulations. He's building a personal
site that is articles-first long-term, but the **landing page comes first** and is
explicitly an aesthetics-first art piece: an enjoyable interface before it is a
navigation utility. The site already has a working Next.js + MDX scaffold (App Router,
React 19, Tailwind, framer-motion, Vitest, Playwright; three.js/r3f and D3 available).

Articles are not yet written, so **the landing experience itself is the content**. The
page must feel alive, allude to Teegin's econ/quant world, and emphasize a theme of
**exploration and innovation** — without reading as a narrow finance dashboard or as
generic "particle background" AI slop.

This spec covers the landing page only. Article reading experience and a project
showcase are deliberately out of scope for this phase (see Out of Scope).

## Concept

A single full-page **scrollytelling landing experience**. One persistent canvas
simulation lives behind everything. As the visitor scrolls, the simulation morphs
through three economic "states," each framed by a short line of copy. The simulation is
the hero, the body, and the through-line; there are no traditional stacked content
sections, just the narrative unfolding over a long scroll, ending in a real navigation
landing zone so visitors are never trapped in the art piece.

The living visual is an **agent-based market converging to equilibrium** — chosen
because it is unmistakably Teegin's own work (not decoration), gives the cursor a
meaningful job, and teases the future interactive articles. It is framed as
exploration/innovation, not as a lecture about markets.

### Narrative spine (three beats + landing zone)

1. **Chaos / arrival** (top, at rest) — Agents scattered and drifting, no order.
   Name + tagline overlaid. Cursor gravity is already live: points bend toward the
   pointer. Copy beat: *who you are* (exploration/innovation framing).
2. **Equilibrium** (mid-scroll) — Agents settle toward a breathing equilibrium line.
   Dragging injects a shock; the system visibly re-converges. Copy beat: *what you do*
   (making complex systems feel intuitive). This beat holds the one explicit "play
   with it" affordance.
3. **Network / emergence** (lower) — Settled points link into a living network
   (econ work as connected ideas). Copy beat: *what's here / where to go*.
4. **Landing zone** (footer) — Quiet, semantic navigation: Articles, Projects, and a
   Substack/Beehiiv follow link. The real way out of the experience.

Scrolling back up reverses the morph; transitions are continuous, no hard cuts.

## Visual System

### Themes — dual, both first-class, with a tactile day/night toggle

- **Phosphor (night, default)** — near-black base (`#06070a`), agents in cyan/sky, a
  teal breathing equilibrium line, settled points glow. Cool, scientific, calm.
- **Ledger (day)** — warm off-white base (`#f2f0ea`), deep teal ink (`#0d5c63`), ochre
  glow on settled agents. Bright "daylight workshop," deliberately NOT AI-cream
  (committed teal/ochre identity, not a warm-neutral default).

The toggle is a small moment, not a checkbox: the whole field crossfades and the
equilibrium line "re-solves" into the new palette. Theme persists via localStorage and
respects `prefers-color-scheme` on first visit.

Both themes are designed to spec (contrast tuned independently), not one theme with a
mechanical inverse.

### Typography — three-family system (all dodge reflex-reject fonts)

- **Display:** Bricolage Grotesque — name, beat headlines. Warm, characterful,
  "essayist who codes."
- **Body:** Geist — taglines, copy. Clean, neutral, readable.
- **Mono (scoped):** Spline Sans Mono — ONLY on numeric/data readouts (e.g.
  `price → equilibrium · drag to shock`). Earns its place on real data; never
  decorative "developer" costume.

Fonts loaded via `next/font` (self-hosted, no layout shift).

### Color & contrast discipline

- OKLCH tokens for both palettes, defined in a tokens layer.
- Body copy ≥ 4.5:1 against its background in BOTH themes; large text ≥ 3:1. In Ledger,
  the tagline goes darker than a muted gray to clear 4.5:1.
- Headings use `text-wrap: balance`; display letter-spacing ≥ -0.04em; hero/display
  clamp max ≤ 6rem.

## Motion & Interaction

The simulation is one continuous system (Canvas 2D, ~60–70 agents), not three separate
animations. A single scroll-progress parameter (0→1) morphs *order* across the beats.

- **Scroll drives the morph:** scroll position blends chaos → equilibrium → network
  smoothly; reverses on scroll-up. No hard cuts.
- **Cursor gravity always live:** agents bend toward the pointer (the "cursor has
  gravity" principle from the vision doc, applied to the whole field).
- **Drag to shock** (equilibrium beat): press/drag scatters agents; on release they
  re-converge. The single explicit "toy."
- **Network beat:** settled agents draw links to nearby neighbors; lines fade in by
  distance.
- **Copy reveals:** each beat's text rises + fades on enter, staggered, ease-out-expo
  (no bounce/elastic). The name gets one deliberate load entrance — not a
  fade-on-every-section reflex.

### Accessibility & performance (non-negotiable)

- `prefers-reduced-motion: reduce`: simulation freezes to a beautiful static
  equilibrium frame; copy crossfades instead of moving; scroll still reveals content.
  Content visibility is NEVER gated on a JS animation firing.
- Device tiering: agent count + effects scale down on low-power/mobile; pointer-move
  work throttled to `requestAnimationFrame`; loop pauses when the tab is hidden.
- Canvas is decorative (`aria-hidden`) with a text fallback; the nav landing zone is
  real semantic HTML, fully keyboard- and screen-reader-navigable.
- Mobile: cursor gravity becomes touch-drag; scrollytelling still drives the morph.

## Architecture

Small, focused files (one responsibility each), per project convention. The simulation
math is framework-agnostic and unit-testable; the canvas is a thin renderer.

| File | Responsibility |
|---|---|
| `app/page.tsx` | Landing route. Assembles scroll container + beats + nav zone. (Replaces the current placeholder home.) |
| `components/hero/EquilibriumField.tsx` | `"use client"` canvas renderer. Pure render loop driven by `scrollProgress` + pointer state. No business logic. |
| `components/hero/useFieldEngine.ts` | Agent simulation state (positions, velocities, convergence, network links). Framework-agnostic, unit-testable. |
| `components/hero/useScrollProgress.ts` | Maps scroll position → 0→1 and per-beat blend factors. |
| `components/hero/Beat.tsx` | One narrative beat (eyebrow + headline + copy); owns its reveal. |
| `components/theme/ThemeProvider.tsx` | Day/night state, localStorage, `prefers-color-scheme`. |
| `components/theme/ThemeToggle.tsx` | The tactile toggle control. |
| `app/globals.css` + tokens | OKLCH tokens for both palettes; `next/font` wiring. |
| Nav landing zone (in `app/page.tsx` or `components/hero/LandingNav.tsx`) | Semantic `<nav>`/`<footer>`: Articles, Projects, Substack. |

The existing Market Structure MDX article and `interactive-visuals/` simulators remain
untouched; the landing page links to the article but does not restyle it this phase.

## Testing (TDD, house stack)

**Unit (Vitest):**
- `useFieldEngine` convergence: after a shock, agents return toward the equilibrium
  line within N ticks; network links form by distance threshold; agent count stays
  stable.
- `useScrollProgress`: scroll position maps to correct 0→1 progress and beat blend.
- Theme persistence: writes/reads localStorage; honors `prefers-color-scheme` default.

**E2E (Playwright):**
- Page renders name + tagline (hero visible).
- Scroll changes rendered state: a later beat's copy becomes visible after scrolling.
- Theme toggle flips palette and persists across reload.
- `prefers-reduced-motion` emulation: static frame + all beat copy visible (not gated).
- Keyboard navigation reaches every nav link.
- Screenshot artifacts written into the goal-eval bundle (`evals/runs/latest/bundle/screenshots/`).

**Completion gate:** `node evals/judge.mjs --all` must return `done` before the work is
claimed complete (deterministic gates supreme; fresh external judge on the checklist).

## Out of Scope (this phase)

- Article reading experience / MDX article restyling.
- Project showcase page and GitHub data integration.
- The "currently / latest cards" strip (future upgrade: swap a network-beat element for
  real latest-article/project cards once content exists — originally option B).
- Integrating Slopcast's r3f/drei theme-scene system (a "someday, for fun" item).
- Substack/Beehiiv backend wiring (the landing zone link is a simple href for now).
- Supabase usage.

## Success Criteria

- A first-time visitor lands, immediately sees something alive, and wants to move the
  cursor / scroll — the page is enjoyable before it is useful.
- The visual reads as specific to Teegin (an economic system converging), not as a
  generic particle background; passes the "how was this made?" not "which AI made
  this?" test.
- Day/night both look intentional and hit contrast targets.
- Reduced-motion and keyboard users get a complete, legible experience.
- All deterministic gates green and `node evals/judge.mjs --all` returns `done`.
