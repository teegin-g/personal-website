# Article System — Design Spec

**Date:** 2026-06-08
**Status:** Approved (shape complete; ready for implementation plan)
**Surface:** Article section (`/articles`, `/articles/[slug]`) — the site's reading home
**Register:** Brand (design IS the product) — long-form interactive content
**Worktree/branch:** `.worktrees/article-system` on `feat/article-system` (isolated from the
parallel hero session working in the main checkout).

## Context

Teegin Groves builds interactive economics essays: markdown prose with embedded React
simulations the reader can manipulate. The landing hero shipped first (see
`2026-06-07-landing-hero-design.md`) and deliberately left the article reading experience
out of scope. PRODUCT.md states the site is **articles-first long-term** — this is the
phase that makes that true.

The current article system is a stub that is also visibly broken:

1. **Invisible prose.** `mdx-components.tsx` hardcodes `text-slate-700`/`text-slate-900`.
   The site defaults to **Phosphor** (near-black, `--bg: oklch(0.16 …)`), so article body
   copy is dark gray on near-black — effectively unreadable. The prose ignores the
   `--ink`/`--body` theme tokens entirely.
2. **A clashing white slab.** The embedded Stigler simulator is a self-contained
   light-mode dashboard (`bg-gradient-to-br from-slate-50 … text-slate-950`, white cards,
   slate UI) dropped onto the dark page. It also declares `max-w-[1600px]` while living
   inside a `max-w-3xl` prose column, so it is simultaneously a blinding rectangle and
   cramped/overflowing.
3. **No system.** One hardcoded route (`/articles/market-structure`), no index, no article
   metadata (title/summary/date/reading-time), no reading shell, no back-navigation, no
   repeatable pattern for embedding a simulator. Two essay drafts sit unwired in
   `articles/`; three more simulators sit unwired in `interactive-visuals/`.

The simulation logic underneath is genuinely strong (real agent-based market simulation,
d3, multiple coordinated views). **The problem is integration and identity, not
capability.** This phase fixes that without touching the simulation math.

## Goal

Build a real, reader-facing article section: a section index, a reusable reading shell
that renders interactive essays beautifully in **both** themes, a theme-native simulator
primitive layer (proven on the Stigler sim), and the flagship Market Structure essay fully
ported. Leave a documented, repeatable path for adding more essays and migrating the
remaining simulators.

## Scope (this phase)

- **Fidelity:** production-ready.
- **Breadth:** articles index + reading shell + simulator primitive layer + Stigler
  migration + Market Structure essay port + an agent-facing authoring guide.
- **Interactivity:** shipped-quality (real components, both themes, reduced-motion safe).

### Confirmed direction (from shape interview, 2026-06-08)

| Decision | Choice |
|---|---|
| How much of the section | **Full section** — index + reading shell + sim integration |
| Simulator treatment | **Theme-native** — reskin to Phosphor/Ledger tokens, both first-class |
| Reading feel | **Distill / Ciechanowski** — generous column, full-bleed interactive figures |
| Simulator breadth this pass | **Primitives + Stigler** — build shared primitive layer, prove on Stigler; other 3 migrate later |
| Content this pass | **Build shell, port Market Structure** — fully port the flagship; others become an "add an article" path |
| Index background | **Toggleable** — reader can turn the live canvas on/off |

## Concept

Reading an essay here should feel like **Bartosz Ciechanowski's interactive articles**: a
calm, generous reading column where the prose carries the argument and a manipulable figure
*is* the proof, breaking out full-bleed at the moment the argument needs it. The simulator
is not a detached widget bolted under a heading; it is the figure inside the sentence
"watch what happens when you change this."

Two reading worlds, both designed to spec (Design Principle 3):

- **Phosphor (night):** oscilloscope-green essay glowing in a dark room. Prose in `--body`
  on near-black; figures are dark instrument panels with teal data.
- **Ledger (day):** the same essay as ink on a warm paper workbench; figures are light
  instrument panels with deep-teal data and ochre highlights.

The simulator stops being "a light-mode app" and becomes a genuine night/day instrument.

## Information architecture

```
/articles                     → section index (reading list)
/articles/market-structure     → flagship essay (MDX + embedded Stigler sim)
/articles/[future-slug]        → same shell, drop in MDX + metadata
```

### Article index — `/articles`

NOT an identical-card grid (banned by the shared absolute bans and by PRODUCT.md
anti-references). A **typographic reading list**:

- Each entry: title (display) + one-line summary + a metadata line (topic · reading time ·
  an "interactive" marker when the essay embeds a simulator).
- The flagship gets visual weight (largest, top); future entries stack beneath on rules,
  not in boxes.
- Built to render N entries cleanly; only Market Structure is live this pass. Others may
  appear as visibly-"draft" entries or be omitted — author's choice via metadata.
- **Toggleable canvas background:** the live `EquilibriumField` (a calmer variant) sits
  behind the list with `copy-scrim` for legibility, and a control lets the reader turn it
  off for a quiet, static background. Preference persists (localStorage), mirroring the
  theme toggle. Default state TBD in the plan (lean: on, calm).

### Reading shell — `/articles/[slug]`

- Reading column ~**68ch** (per the General rules cap of 65–75ch), centered, generous
  vertical rhythm.
- **Article header:** title (display, `text-wrap: balance`), summary (`--body`), a metadata
  row (topic · date · reading time), and a back-to-index link. `ThemeToggle` remains
  available while reading.
- **Static reading background** by default (prose is the focus); the live canvas is a
  landing/index affordance, not a per-paragraph distraction. (If desired later, the same
  toggle can extend here — out of scope to wire on the reading page this pass.)
- **Theme-bound MDX components:** h1–h3, p, strong, em, ul/ol/li, blockquote, inline
  `code`, links — all reading from `--ink`/`--body`/`--accent`, replacing the hardcoded
  slate. This is the actual rendering fix.
- **`<Figure>` / full-bleed breakout:** a primitive that lets an embedded simulator escape
  the reading column to a wide instrument panel, with a caption ("Drag the sliders to…").
  This is the Ciechanowski move that makes the sim read as a figure in the argument.

## Visual System

Reuses the **shipped** Phosphor/Ledger tokens (no design-system surgery — the hero session
owns the core palette). Color strategy stays **Committed**: teal accent in both worlds,
ochre glow as the day-world warmth, color carries the brand.

### Token additions (additive only)

The simulator internals need a few roles the current 7-token set doesn't name. Add these to
`app/globals.css` (both themes) and map in `tailwind.config.ts`. Names and values finalized
in the plan; intent:

| New role | Purpose | Phosphor intent | Ledger intent |
|---|---|---|---|
| `--muted` | secondary labels, axis text, hints | dim cool gray, ≥4.5:1 where it carries text | dim warm gray, ≥4.5:1 |
| `--grid-line` | chart gridlines, hairline borders, dividers | low-alpha cool | low-alpha warm |
| `--panel` | instrument-panel surface (distinct from `--surface`) | a touch above `--bg` | a touch below `--bg` |
| `--positive` / `--danger` | gain/loss readouts (Δ share, margin sign) | desaturated teal-green / rose, AA on panel | deeper variants, AA on panel |

Existing tokens (`--bg --surface --ink --body --accent --agent --glow`) are unchanged.
Both palettes keep body text ≥ 4.5:1 and large text ≥ 3:1 (verified in browser, Task 10
equivalent).

### Typography

Reuses the loaded three-family system; no new fonts.

- **Display** — Bricolage Grotesque: article title, section headings (h2/h3).
- **Body** — Geist: prose. `leading-relaxed`/`leading-7`, `text-pretty`, ~68ch measure.
- **Mono (scoped)** — Spline Sans Mono: ONLY numeric/data readouts inside sims, axis
  values, the metadata line, and the figure caption's data label. Never prose. Reinforces
  "the essayist who codes" without mono-as-costume (brand ban).

Prose scale uses a modular ratio ≥1.25 between steps (h1 → h2 → h3 → body), not the flat
4xl/2xl/xl the current `mdx-components.tsx` ships.

## Simulator primitive layer — `components/sim/*`

Theme-aware presentation primitives that replace the slate-hardcoded internals. The d3 /
simulation logic in `interactive-visuals/*.jsx` is **untouched**; this is purely the
presentation skin, extracted so all four sims can adopt it.

| Primitive | Replaces | Notes |
|---|---|---|
| `SimFrame` | the `min-h-screen bg-gradient-to-br from-slate-50` slab + outer `Card`s | The instrument panel: `--panel` surface, themed border, sensible max-width inside a full-bleed `<Figure>`. Not a `min-h-screen` page. |
| `SimSlider` | the bespoke `Slider` (slate text, `accent-slate-900`) | Themed track/thumb (`--accent`), `--ink` label, `--muted` hint, themed comparison chip. |
| `SimReadout` | `MetricCard` (the banned hero-metric template) | A quieter readout strip/row, not a 4-up card grid. Δ values use `--positive`/`--danger`. |
| `SimChart` styling | the slate gridlines/axes/dots in `HtmlScatterPlot`/`HtmlLineChart` | Gridlines → `--grid-line`; axis text → `--muted`; user series → `--ink`/`--accent`; tooltips → `--panel`. Geometry/d3 scales unchanged. |
| `SimButton` / `SimSelect` / `SimToggle` | inline slate buttons, `<select>`, debug tabs | Themed controls reading `--accent`/`--surface`/`--ink`. |

**Proven by migrating the Stigler sim** (`StiglerBarrierMarketSimulator`) to render
correctly and intentionally in Phosphor *and* Ledger. The migration is a reskin: swap slate
utility classes for primitives/tokens, drop the `min-h-screen` page framing (it's a figure
now), keep every state and computation.

The three remaining sims (Entry Barrier Dynamics, Imitability/Differentiation, Network
Production) are **out of scope to migrate this pass** but adopt the same primitives later;
the authoring guide documents how.

## Motion & Interaction

- **Reveals:** sections/figures rise + fade on enter, reusing the Beat convention
  (ease-out-expo `cubic-bezier(0.16, 1, 0.3, 1)`, no bounce). Reveals enhance
  already-visible content; never gate visibility on a class-triggered transition.
- **Figure breakout:** a `<Figure>` animates to its full-bleed width on scroll-in (transform
  only, not layout thrash).
- **Simulator:** live recompute on slider drag (already wired); "new hidden market" reshuffle;
  reset; debug mode — all theme-correct.
- **Index canvas toggle:** crossfades the live field to/from a static calm frame.

### Accessibility & performance (non-negotiable)

- `prefers-reduced-motion: reduce`: reveals become crossfades/instant; the index canvas
  renders a static settled frame; **content is never gated on a JS animation firing.**
- Reading content is semantic HTML (`<article>`, headings, lists), fully keyboard- and
  screen-reader-navigable. The back-to-index and theme/canvas toggles are real buttons/links
  with labels.
- The index canvas is decorative (`aria-hidden`); the toggle that disables it is a labeled
  control.
- Sim controls keep visible focus states and accessible labels; the chart's interactive dots
  remain `aria-label`'d (the source already does this).
- Both themes hit contrast targets; the **Ledger** prose body and any `--muted` text that
  carries information clear 4.5:1.

## Architecture

Small, focused files per project convention.

| File | Responsibility | New/Modify |
|---|---|---|
| `app/globals.css` | Add `--muted`, `--grid-line`, `--panel`, `--positive`, `--danger` to both themes. | Modify |
| `tailwind.config.ts` | Map the new tokens to Tailwind colors. | Modify |
| `mdx-components.tsx` | Theme-bound prose components (replace hardcoded slate). | Modify |
| `lib/articles/registry.ts` | Pure article metadata registry (slug, title, summary, topic, date, readingTime, interactive, status). Unit-tested. | New |
| `components/articles/ArticleShell.tsx` | Reading layout: header, measure, back-nav, theme toggle. | New |
| `components/articles/Figure.tsx` | Full-bleed breakout + caption wrapper for embedded sims/figures. | New |
| `components/articles/ArticleIndex.tsx` | The reading-list index UI. | New |
| `components/articles/IndexCanvas.tsx` | Toggleable calm `EquilibriumField` background + persisted on/off. | New |
| `components/sim/*` | The simulator primitive layer (SimFrame, SimSlider, SimReadout, SimButton, SimSelect, chart styling helpers). | New |
| `app/articles/page.tsx` | `/articles` index route. | New |
| `app/articles/[slug]/` or per-route `page.mdx` | Reading route(s) using the shell. Market Structure ported here. | New/Modify |
| `interactive-visuals/Stigler Barrier Market Simulator.jsx` | Reskinned to primitives/tokens; **logic unchanged.** | Modify (presentation only) |
| `articles/` source `.md` | Source of truth for the ported essay (cleaned). | Reference |

The landing hero, `ThemeProvider`/`ThemeToggle`, `EquilibriumField` engine, and the three
unmigrated sims remain untouched in behavior.

## Testing (TDD, house stack)

**Unit (Vitest):**
- `lib/articles/registry`: returns flagship; lists entries sorted; metadata shape valid;
  reading-time format; an "interactive" essay is flagged.
- Sim primitive(s) that contain pure logic (e.g. a readout formatter / Δ-sign classifier) —
  pure helpers extracted from the primitives are unit-tested; visual primitives are covered
  by e2e.
- Keep the existing 19 unit tests green (no regression).

**E2E (Playwright):**
- `/articles` index renders the flagship entry and links into it.
- Reading page renders MDX prose **and** the simulator island hydrates (a sim control is
  present) — extend the existing `article.spec.ts`.
- **Legibility in both themes:** on the reading page, assert computed `color` of prose body
  has sufficient contrast against `--bg` in Phosphor AND after toggling to Ledger
  (the core bug this phase fixes). Screenshot both themes into the goal-eval bundle.
- Index canvas toggle turns the background on/off and persists across reload.
- `prefers-reduced-motion`: all prose visible, sim shows a static usable frame, nothing
  gated.
- Keyboard: back-to-index and toggles reachable.
- Screenshot artifacts written to `evals/runs/latest/bundle/screenshots/`.

**Completion gate:** `node evals/judge.mjs --all` must return a `done` verdict before the
work is claimed complete. Deterministic gates (typecheck, build, unit, e2e) are supreme; a
fresh external judge grades the checklist (UI behavior + no-regression).

## Deliverables

1. The article section (index + reading shell + Figure + Stigler migration + Market
   Structure essay), production-ready in both themes.
2. The simulator primitive layer under `components/sim/`.
3. **`docs/articles/AUTHORING.md`** — the durable, agent-facing guide the user asked for:
   how to add an article (route + metadata + MDX + embedding a sim as a `<Figure>`), how to
   build/migrate a theme-native simulator on the primitives, the token contract, and the
   testing/gate expectations.

## Out of Scope (this phase)

- Migrating the other three simulators (Entry Barrier Dynamics,
  Imitability/Differentiation, Network Production) to the primitives — documented path only.
- Porting the AI Overview essay (it's a 20-word stub) and authoring new essays.
- A projects showcase page; the landing `/projects` link stays forward-wiring.
- Substack/Beehiiv backend; comments; search; tags taxonomy beyond a single "topic" field.
- Restyling the landing hero or changing the core token palette (the parallel session owns
  the hero; we only add tokens, additively).
- Wiring the live canvas onto the reading page (index/landing only this pass).

## Success Criteria

- An essay is fully legible and intentional in **both** themes; the slate-on-near-black bug
  is gone (proven by an e2e contrast assertion in both themes).
- The embedded Stigler simulator reads as a designed night/day instrument and a *figure in
  the argument*, not a clashing white dashboard; no overflow at any breakpoint.
- `/articles` presents a real, non-card-grid reading list with the flagship; the canvas
  background is toggleable and the preference persists.
- A future agent can add an essay and a theme-native simulator by following
  `docs/articles/AUTHORING.md` without re-deriving the system.
- The section passes the brand slop test: "how was this made?", not "which AI made this?"
- All deterministic gates green and `node evals/judge.mjs --all` returns `done`.
