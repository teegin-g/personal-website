# Article System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax. TDD: write the failing test first where a test is
> specified. Commit after each task.

**Goal:** Build a reader-facing article section — a typographic index, a reusable reading
shell that renders interactive essays beautifully in both Phosphor/Ledger themes, a
theme-native simulator primitive layer (proven on the Stigler sim), and the Market
Structure essay fully ported — plus an agent-facing authoring guide.

**Design reference:** `docs/superpowers/specs/2026-06-08-article-system-design.md`

**Worktree/branch:** `.worktrees/article-system` on `feat/article-system` (isolated from
the parallel hero session in the main checkout). Baseline at start: 19/19 unit, 7/7 e2e.

**Tech stack:** Next.js 15 (App Router, React 19), TypeScript, Tailwind, @next/mdx, d3,
framer-motion 11, Vitest + Testing Library, Playwright. Design executed with the
`impeccable` skill; completion gated by `node evals/judge.mjs --all`.

**Hard constraints:**
- Do NOT change existing palette tokens (`--bg --surface --ink --body --accent --agent
  --glow`) or the landing hero — the parallel session owns them. Token work is **additive
  only**.
- Do NOT change simulation/d3 math in `interactive-visuals/*.jsx`. The Stigler migration is
  **presentation-only** (swap slate classes for primitives/tokens, drop `min-h-screen` page
  framing). Every state and number must compute identically.
- Keep the existing 19 unit + 7 e2e tests green at every commit.

---

## File structure

| File | Responsibility | New/Modify |
|---|---|---|
| `app/globals.css` | Add `--muted --grid-line --panel --positive --danger` to both themes | Modify |
| `tailwind.config.ts` | Map new tokens to Tailwind colors | Modify |
| `next.config.mjs` | Silence nested-lockfile warning via `outputFileTracingRoot` | Modify |
| `mdx-components.tsx` | Theme-bound prose components (replace hardcoded slate) | Modify |
| `lib/articles/registry.ts` | Pure article metadata registry + helpers | New |
| `lib/sim/format.ts` | Pure readout helpers (Δ-sign class, pct/money formatting) extracted for unit test | New |
| `components/sim/SimFrame.tsx` | Instrument-panel surface (replaces the slate slab) | New |
| `components/sim/SimSlider.tsx` | Themed slider + comparison chip | New |
| `components/sim/SimReadout.tsx` | Quiet readout row (replaces hero-metric cards) | New |
| `components/sim/SimControls.tsx` | Themed button/select/toggle/tab primitives | New |
| `components/sim/chart.ts` | Themed chart style constants (gridline/axis/series colors) | New |
| `components/articles/Figure.tsx` | Full-bleed breakout + caption wrapper | New |
| `components/articles/ArticleShell.tsx` | Reading layout: header, measure, back-nav, toggle | New |
| `components/articles/ArticleIndex.tsx` | Reading-list index UI | New |
| `components/articles/IndexCanvas.tsx` | Toggleable calm EquilibriumField background (persisted) | New |
| `app/articles/page.tsx` | `/articles` index route | New |
| `app/articles/market-structure/page.mdx` | Flagship essay ported, wrapped in ArticleShell | Modify |
| `interactive-visuals/Stigler Barrier Market Simulator.jsx` | Reskin to primitives/tokens; logic unchanged | Modify |
| `tests/unit/articleRegistry.test.ts` | Registry behavior | New |
| `tests/unit/simFormat.test.ts` | Pure readout helpers | New |
| `tests/e2e/article.spec.ts` | Extend: both-theme legibility, sim hydration, reduced-motion | Modify |
| `tests/e2e/articles-index.spec.ts` | Index renders list, links in, canvas toggle persists | New |
| `docs/articles/AUTHORING.md` | Agent-facing authoring guide | New |

---

## Task 0: Silence the nested-lockfile build warning

The worktree has its own `package-lock.json`; Next warns about multiple lockfiles.

- [ ] Add to `next.config.mjs` `nextConfig`: `outputFileTracingRoot: import.meta.dirname`
      (or the worktree root). Verify `npm run build` no longer prints the warning.
- [ ] Commit: `chore(build): pin outputFileTracingRoot to silence lockfile warning`

---

## Task 1: Additive theme tokens

**Files:** `app/globals.css`, `tailwind.config.ts`

- [ ] **Step 1:** Add to BOTH `[data-theme="phosphor"]` and `[data-theme="ledger"]` blocks
      in `globals.css` (values are starting points; finalize against contrast checks in
      Task 9):

```css
/* phosphor (night) additions */
--muted: oklch(0.62 0.02 230);      /* secondary labels/axis text; verify ≥4.5:1 where textual */
--grid-line: oklch(0.30 0.01 250);  /* hairlines/gridlines (used at low alpha) */
--panel: oklch(0.19 0.014 250);     /* instrument panel, between bg and surface */
--positive: oklch(0.80 0.12 165);   /* gains */
--danger: oklch(0.70 0.15 20);      /* losses */

/* ledger (day) additions */
--muted: oklch(0.48 0.02 60);
--grid-line: oklch(0.80 0.01 95);
--panel: oklch(0.97 0.008 95);
--positive: oklch(0.50 0.10 165);
--danger: oklch(0.52 0.18 25);
```

- [ ] **Step 2:** Map in `tailwind.config.ts` `theme.extend.colors`: `muted`, `panel`,
      `positive`, `danger`, and `"grid-line": "var(--grid-line)"`.
- [ ] **Step 3:** `npx tsc --noEmit` (config typechecks) and `npm run build` exit 0.
      Existing palette tokens untouched — confirm the diff only adds lines.
- [ ] **Step 4:** Commit: `feat(theme): additive sim/reading tokens (muted, panel, grid-line, positive, danger)`

---

## Task 2: Pure article registry (TDD)

**Files:** `lib/articles/registry.ts`, `tests/unit/articleRegistry.test.ts`

- [ ] **Step 1 — failing test.** Cover: `getArticles()` returns entries; the flagship
      (`market-structure`) is present and `interactive: true`; entries expose
      `{ slug, title, summary, topic, date, readingMinutes, interactive, status }`;
      `getArticle(slug)` returns one or `undefined`; published entries sort newest-first;
      `formatReadingTime(n)` → e.g. `"7 min read"`.
- [ ] **Step 2:** Run, verify it fails (module missing).
- [ ] **Step 3 — implement.** A typed `Article` interface and a hand-maintained array
      (this is the source of truth for index + per-article header; MDX files stay the prose
      source). `status: "published" | "draft"`. Helpers pure, no DOM.
- [ ] **Step 4:** Run, verify pass. Confirm the existing 19 unit tests still pass.
- [ ] **Step 5:** Commit: `feat(articles): pure article metadata registry with tests`

---

## Task 3: Pure sim readout helpers (TDD)

**Files:** `lib/sim/format.ts`, `tests/unit/simFormat.test.ts`

Extract the formatting/sign logic the primitives need so it's unit-testable (the visual
primitives themselves are covered by e2e).

- [ ] **Step 1 — failing test.** `formatPct`, `formatMoney`, `formatCompact` (port the
      source sim's behavior, including `"--"` for non-finite), and `deltaTone(value)` →
      `"positive" | "danger"` for ≥0 / <0. Mirror current sim output exactly so the reskin
      is behavior-preserving.
- [ ] **Step 2:** Run, verify fails.
- [ ] **Step 3 — implement.** Pure functions; `formatCompact` uses d3 `~s` with the `G→B`
      replacement already in the sim.
- [ ] **Step 4:** Run, verify pass + no regression.
- [ ] **Step 5:** Commit: `feat(sim): pure readout/format helpers with tests`

---

## Task 4: Simulator primitive layer

**Files:** `components/sim/SimFrame.tsx`, `SimSlider.tsx`, `SimReadout.tsx`,
`SimControls.tsx`, `components/sim/chart.ts`

Theme-aware primitives reading the tokens. No simulation logic here. Design with
`/impeccable` craft sensibilities (this is the visual heart of the phase).

- [ ] **SimFrame:** instrument panel — `bg-panel`, themed border (`border-grid-line` or
      `border-accent/15`), rounded, padding; an optional header slot (eyebrow in mono +
      title in display). NOT `min-h-screen`. Sits inside a `<Figure>`.
- [ ] **SimSlider:** label `text-ink`, hint `text-muted`, value chip on `--surface`; themed
      `<input type=range>` (accent track/thumb via `accent-[var(--accent)]` + focus ring);
      optional user-vs-market comparison chip (themed, replacing the white/slate grid).
- [ ] **SimReadout:** a horizontal readout row/strip (label in mono `text-muted`, value in
      `text-ink` tabular-nums; Δ values colored via `deltaTone` → `text-positive`/
      `text-danger`). Explicitly NOT a 4-up `MetricCard` grid (banned hero-metric template).
- [ ] **SimControls:** `SimButton` (variants: solid `bg-accent text-bg`, ghost), `SimSelect`
      (themed native select), `SimToggle`/tab. All keyboard-focusable with visible rings.
- [ ] **chart.ts:** exported style constants/classes for charts — `gridLine`, `axisText`,
      `userSeries`, `rivalSeries`, `tailSeries`, `tooltipSurface` — all token-based. Geometry
      stays in the sim; only colors move here.
- [ ] **Verify:** `npx tsc --noEmit` exit 0. (Visual proof comes in Task 6/9.)
- [ ] **Commit:** `feat(sim): theme-native primitive layer (frame, slider, readout, controls, chart styles)`

---

## Task 5: Reading shell, Figure, theme-bound MDX prose

**Files:** `mdx-components.tsx`, `components/articles/ArticleShell.tsx`,
`components/articles/Figure.tsx`

- [ ] **Step 1 — `mdx-components.tsx`:** replace hardcoded `text-slate-*` with token classes.
      `p` → `text-body`, `strong` → `text-ink`, headings → `text-ink font-display` with a
      modular scale (h1 `text-balance`, h2/h3 with ≥1.25 steps), `ul/ol/li`, `blockquote`
      (themed left treatment that is NOT a thick colored side-stripe — use full border or
      tint per the absolute bans), inline `code` → mono on `--surface`, `a` → `text-accent`
      with underline affordance + focus ring. Measure handled by the shell.
- [ ] **Step 2 — `Figure.tsx`:** wraps embedded content; supports a `bleed` mode that breaks
      out of the reading column to near-full-viewport width (CSS `margin-inline` negative or a
      grid escape), with a `<figcaption>` (caption text `text-muted`, optional mono data
      label). Reveal on scroll-in (transform/opacity, ease-out-expo) with reduced-motion
      fallback (no transform). Reduced-motion: content visible by default, never gated.
- [ ] **Step 3 — `ArticleShell.tsx`:** `<article>` with a centered ~68ch measure, the header
      (back-to-index link, title display, summary, metadata row from the registry), the
      `ThemeToggle`, and `{children}` (MDX). Static background (no live canvas on the reading
      page this pass).
- [ ] **Step 4:** `npx tsc --noEmit` exit 0.
- [ ] **Step 5:** Commit: `feat(articles): reading shell, Figure breakout, theme-bound MDX prose`

---

## Task 6: Migrate the Stigler simulator to the primitives (presentation-only)

**File:** `interactive-visuals/Stigler Barrier Market Simulator.jsx`

The reskin. **Logic frozen** — only swap presentation. Browser-driven craft pass.

- [ ] **Step 1:** Replace the outer `min-h-screen bg-gradient-to-br from-slate-50 … text-slate-950`
      wrapper — the sim renders inside a `<Figure bleed>` now, so it fills the figure, not the
      viewport. Remove the standalone `<h1>`/intro page chrome (the article prose introduces it);
      keep a compact `SimFrame` header if useful.
- [ ] **Step 2:** Swap primitives: bespoke `Slider`→`SimSlider`, `MetricCard` 4-up grid→
      `SimReadout` strip, `Button`→`SimButton`, `<select>`→`SimSelect`, debug tabs→`SimToggle`.
- [ ] **Step 3:** Recolor charts via `components/sim/chart.ts`: gridlines `--grid-line`, axis
      text `--muted`, user series `--ink`/`--accent`, rival/tail series themed, tooltip on
      `--panel`. Keep all d3 scales, geometry, hover logic, and the firm/period math intact.
      Route number formatting through `lib/sim/format.ts`.
- [ ] **Step 4:** Replace remaining `text-slate-*`, `bg-white`, `bg-slate-*`, `border-slate-*`,
      `accent-slate-900`, emerald/rose Δ colors with tokens (`--positive`/`--danger`). Grep to
      confirm no `slate`/`white` literals remain in the file.
- [ ] **Step 5 — browser verify (both themes):** `npm run dev`; open the article; screenshot
      the sim in Phosphor and Ledger at 1440px and 390px. Confirm: legible, no overflow, sliders/
      charts/tooltips/debug all themed, numbers identical to pre-reskin (spot-check a few against
      `git stash`/main). Use `/impeccable polish` judgment on the figure.
- [ ] **Step 6:** Commit: `feat(sim): theme-native Stigler simulator on shared primitives`

---

## Task 7: Port the Market Structure essay + embed the sim as a Figure

**Files:** `app/articles/market-structure/page.mdx`, registry entry

- [ ] **Step 1:** Port the full essay from `articles/Market Structure Article.md` (currently
      the route has only ~2 sections; the source has intro + 4 Factors + Barriers + Economies +
      Differentiation/Network stubs). Fix the source typos ("highschool", "enterring",
      "hodge podge", etc.). Keep Teegin's voice; no em dashes (use the source's own phrasing,
      cleaned). Wrap content in `ArticleShell` (via the route or a layout) so it gets the header,
      measure, and toggle.
- [ ] **Step 2:** Embed `<StiglerBarrierMarketSimulator />` inside `<Figure bleed caption="…">`
      at the Barriers-to-Entry section, with a caption that tells the reader what to do
      ("Drag your firm's costs and watch who survives the shakeout.").
- [ ] **Step 3:** Add/confirm the registry entry (title, summary, topic "Economics",
      readingMinutes, `interactive: true`, `status: "published"`).
- [ ] **Step 4:** `npx tsc --noEmit && npm run build` exit 0.
- [ ] **Step 5:** Commit: `content(articles): port full Market Structure essay with embedded figure`

---

## Task 8: Articles index with toggleable canvas

**Files:** `components/articles/ArticleIndex.tsx`, `components/articles/IndexCanvas.tsx`,
`app/articles/page.tsx`

- [ ] **Step 1 — `IndexCanvas.tsx`:** a calm variant of `EquilibriumField` as a fixed
      `aria-hidden` background, with a labeled toggle to disable it; preference persists in
      localStorage (mirror `THEME_KEY` pattern, e.g. `tg-index-canvas`). Reduced-motion → static
      frame. Off state → quiet static background (no canvas work).
- [ ] **Step 2 — `ArticleIndex.tsx`:** typographic reading list from `getArticles()`. Each
      entry: title (display), summary (`--body`), metadata line (topic · readingTime ·
      "Interactive" marker when `interactive`) on rules — NOT a card grid. Flagship gets weight.
      `copy-scrim` where text crosses the canvas. Draft entries (if shown) visibly marked.
- [ ] **Step 3 — `app/articles/page.tsx`:** compose IndexCanvas + ArticleIndex + ThemeToggle;
      add page `metadata` (title/description).
- [ ] **Step 4:** `npx tsc --noEmit && npm run build` exit 0.
- [ ] **Step 5:** Commit: `feat(articles): typographic index with toggleable canvas background`

---

## Task 9: E2E coverage + both-theme legibility proof

**Files:** `tests/e2e/article.spec.ts` (extend), `tests/e2e/articles-index.spec.ts` (new)

- [ ] **Step 1 — extend `article.spec.ts`:**
  - Keep the existing two passing tests (prose + sim island; landing→article nav).
  - Add **both-theme legibility:** load the article; read computed `color` of a prose `<p>`
    and the page `background`; assert a contrast ratio ≥ 4.5:1 in Phosphor; toggle to Ledger;
    re-assert ≥ 4.5:1. (Small luminance/contrast helper in the spec.) This is the regression
    lock for the original bug.
  - Add **reduced-motion:** prose fully visible and a sim control present under
    `reducedMotion: "reduce"`.
  - Screenshot the article in both themes into `evals/runs/latest/bundle/screenshots/`.
- [ ] **Step 2 — `articles-index.spec.ts`:** `/articles` shows the flagship entry and links
      into `/articles/market-structure`; the canvas toggle flips state and persists across
      reload; screenshot the index (both themes).
- [ ] **Step 3:** `npx playwright test` — all green (existing 7 + new). If the legibility
      assertion fails, fix the **tokens/classes**, not the assertion.
- [ ] **Step 4:** Commit: `test(articles): both-theme legibility, index, sim hydration, reduced-motion`

---

## Task 10: Impeccable polish pass (browser-driven)

Craft pass across the reading shell, index, Figure, and the Stigler figure. Real pixels.

- [ ] **Step 1:** `npm run dev`; screenshot `/articles` and `/articles/market-structure` in
      both themes at 1440px and 390px.
- [ ] **Step 2:** Verify against the craft bars:
  - Prose body ≥ 4.5:1 in BOTH themes (Ledger especially); any informational `--muted` text
    ≥ 4.5:1; large text ≥ 3:1. Placeholder/caption text not too light.
  - Measure 65–75ch; modular type scale ≥1.25 between steps; headings `text-wrap: balance`,
    long prose `text-pretty`.
  - Figure breakout aligns cleanly; no horizontal overflow at 390px; the sim fits its figure
    at every breakpoint (the original overflow bug is gone).
  - No banned patterns: no side-stripe blockquote, no hero-metric card grid, no identical
    card grid on the index, no gradient text, no decorative glass.
  - Copy: no em dashes, no buzzwords, no aphoristic-cadence triplets; link text standalone;
    button labels verb+object.
  - Motion eases out (no bounce); reveals enhance already-visible content; reduced-motion
    crossfades.
- [ ] **Step 3:** Fix inline; re-screenshot. Keep sim math + registry/format logic frozen
      (covered by tests).
- [ ] **Step 4 — re-run all gates:** `npx tsc --noEmit && npx vitest run && npm run build &&
      npx playwright test` — all green.
- [ ] **Step 5:** Commit: `polish(articles): impeccable craft pass on type, contrast, figure, motion, copy`

---

## Task 11: Authoring guide (docs/articles/AUTHORING.md)

The durable repo doc the user asked for. (Written here as a task; may be drafted earlier so
the system is documented as it's built.)

- [ ] Write `docs/articles/AUTHORING.md` covering:
  - **Add an article:** create the route under `app/articles/<slug>/page.mdx`, wrap in
    `ArticleShell`, add a registry entry (every field explained), write MDX prose (which
    components are themed for you).
  - **Embed a simulator as a figure:** `<Figure bleed caption="…">`, the client-island
    re-export pattern (`components/visuals/*` thin wrapper around `interactive-visuals/*.jsx`),
    why the wrapper exists.
  - **Build/migrate a theme-native simulator:** the `components/sim/*` primitives, the token
    contract (`--panel --muted --grid-line --positive --danger` + existing palette), the rule
    that simulation math stays in `interactive-visuals/` and only presentation uses tokens, and
    a migration checklist (grep for `slate`/`white`, route numbers through `lib/sim/format.ts`).
  - **Testing & gates:** unit for pure logic, e2e for both-theme legibility + hydration, and
    `node evals/judge.mjs --all` before "done".
- [ ] Add a pointer to it from `AGENTS.md` (and/or `CLAUDE.md`) so future agents discover it.
- [ ] Commit: `docs(articles): authoring guide for essays + theme-native simulators`

---

## Task 12: Goal-eval completion gate

**Files:** `evals/runs/latest/{request.md,checklist.json,changed-files.txt,diff.patch}`
(gitignored bundle).

- [ ] **Step 1:** Write `request.md` — this phase's goal + reference to the spec.
- [ ] **Step 2:** Write `checklist.json` (schema `project-setup/eval-checklist` v1). Use
      correct `proof` types:
  - C1 (build, `typecheck`): `npm run build` exits 0.
  - C2 (typecheck, `typecheck`): `npx tsc --noEmit` exits 0.
  - C3 (unit, `unit`): vitest green incl. registry + sim-format; existing 19 still pass.
  - C4 (legibility, `playwright`): prose ≥4.5:1 in BOTH themes on the article page.
  - C5 (sim hydration + figure, `playwright`/`screenshot`): sim control present; screenshots
    of the themed figure in both themes exist.
  - C6 (index, `playwright`): `/articles` lists flagship, links in, canvas toggle persists.
  - C7 (no-regression, `diff`/`playwright`): landing hero + `ThemeProvider` behavior unchanged;
    sim math unchanged (numbers spot-checked); core palette tokens untouched.
- [ ] **Step 3:** Build `changed-files.txt` + `diff.patch` across all phase commits.
- [ ] **Step 4:** `node evals/judge.mjs --all` → expect `done`. If `not-done`, read
      `verdict.json`, repair (or fix a mis-tagged proof), re-run gates, re-judge. Deterministic
      gates supreme.
- [ ] **Step 5:** Commit: `chore(articles): goal-eval bundle — article system done verdict`

---

## Finishing

Use superpowers:finishing-a-development-branch to integrate: review the full diff against
the spec's Success Criteria, then merge `feat/article-system` → `main` (or open a PR) and
remove the worktree. Coordinate with the hero session before merge so the additive token
changes and the hero's token block don't conflict (they shouldn't — we only append).

---

## Self-review

**Spec coverage:**
- Invisible-prose bug (token-bound MDX) → Task 5; regression lock → Task 9 legibility. ✓
- Clashing white slab / overflow (theme-native sim, figure framing) → Tasks 4, 6, 7. ✓
- No-system (index + shell + registry + Figure) → Tasks 2, 5, 8. ✓
- Theme-native, both first-class → Tasks 1, 4, 6, 9 (both-theme proof). ✓
- Ciechanowski reading feel (measure, full-bleed Figure) → Tasks 5, 7. ✓
- Toggleable index canvas, persisted → Task 8; e2e → Task 9. ✓
- Primitives + Stigler only (others documented) → Tasks 4, 6, 11. ✓
- Build shell, port Market Structure → Task 7. ✓
- Authoring guide deliverable → Task 11. ✓
- Goal-eval gate → Task 12. ✓
- No-regression / additive-only / frozen sim math → constraints + Task 12 C7. ✓

**Out of scope honored:** other 3 sims not migrated (path documented), AI Overview not
ported, no projects page, no live canvas on reading page, hero/core-palette untouched.

**Placeholder scan:** token values flagged as "finalize against contrast in Task 9"; no
TODOs left in shipped code.
