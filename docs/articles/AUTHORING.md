# Authoring Guide: Articles & Theme-Native Simulators

This is the durable reference for adding essays and interactive simulators to the site.
It documents the system **as built**. Cross-reference the design and plan docs for the
why; this doc is the how.

- Design spec: [`docs/superpowers/specs/2026-06-08-article-system-design.md`](../superpowers/specs/2026-06-08-article-system-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-06-08-article-system.md`](../superpowers/plans/2026-06-08-article-system.md)

## Overview

An article is **MDX prose with embedded interactive simulator islands**, rendered in a
reusable reading shell that works first-class in **both** themes: Phosphor (near-black
night) and Ledger (warm off-white day). Prose is auto-themed; simulators are reskinned to
shared theme-native primitives so they never look like a foreign light-mode dashboard
dropped onto a dark page.

The moving parts:

| Part | File | Role |
|---|---|---|
| Registry | `lib/articles/registry.ts` | Pure metadata + helpers (title, summary, date, status...) |
| Reading shell | `components/articles/ArticleShell.tsx` | Header, measure, back-nav, theme toggle |
| Figure | `components/articles/Figure.tsx` | Full-bleed breakout + caption wrapper for sims |
| Prose theming | `mdx-components.tsx` | Binds every MDX element to the token contract |
| Sim primitives | `components/sim/*` | Frame, slider, readout, controls, chart styles |
| Format helpers | `lib/sim/format.ts` | `formatPct` / `formatMoney` / `formatCompact` / `deltaTone` |
| Sim source | `interactive-visuals/*.jsx` | The heavy simulation math + d3 views (untouched) |
| Sim wrapper | `components/visuals/*.tsx` | Thin `"use client"` re-export MDX imports |
| Index | `app/articles/page.tsx` + `ArticleIndex.tsx` + `IndexCanvas.tsx` | Lists published articles |

Routes: `/articles` (the index) and `/articles/<slug>` (one essay per `page.mdx`).

## 1. Add a new article

### Step 1: Create the page

Create `app/articles/<slug>/page.mdx`. The directory name **is** the route slug.

### Step 2: Register the metadata

Add an entry to the `articles` array in `lib/articles/registry.ts`. The `Article` shape:

```ts
export interface Article {
  slug: string;                       // URL segment; must match the page.mdx directory name
  title: string;                      // Rendered as the <h1> by the shell
  summary: string;                    // One-line dek; rendered by the shell under the title
  topic: string;                      // Short category label, e.g. "Economics"
  date: string;                       // ISO "YYYY-MM-DD"; drives newest-first sort
  readingMinutes: number;             // Integer; rendered as "N min read"
  interactive: boolean;               // true shows an "Interactive" marker on the index
  status: "published" | "draft";      // see below
}
```

Registry helpers (all pure, unit-tested in `tests/unit/articleRegistry.test.ts`):

- `getArticles()` - every entry, in declaration order.
- `getArticle(slug)` - the matching entry or `undefined`.
- `getPublishedArticles()` - only `status: "published"`, sorted **newest date first**.
- `formatReadingTime(minutes)` - returns `"N min read"`.

**Draft vs published:** the index (`ArticleIndex`) calls `getPublishedArticles()`, so a
`draft` entry never appears on `/articles`. Its `/articles/<slug>` route still renders if
the `page.mdx` exists (the route is the file, not the registry). Set `status: "published"`
to surface it on the index.

### Step 3: Wrap the body in the shell

The MDX body must be wrapped in `<ArticleShell slug="<slug>">…</ArticleShell>`. The shell
looks up the registry entry by `slug` and renders the back-nav, `<h1>` title, summary,
metadata row (topic / date / reading time), a divider, and the theme toggle.

**Rule:** because the shell already renders the title and summary, the MDX body must
**start at the first `##`**. Do **not** add your own `#` (h1) or repeat the summary as a
paragraph - that would duplicate what the shell shows.

### Step 4: Just write markdown

Every prose element is auto-themed by `mdx-components.tsx` to the token contract (legible
in both themes). You do not style prose by hand. Themed elements:

`h1`-`h6`, `p`, `strong`, `em`, `a`, `ul` / `ol` / `li`, `blockquote`, `code`, `pre`, `hr`.

Headings use `text-ink`; running prose uses `text-body` (tuned to >=4.5:1 on `bg` in both
themes). The reading measure (~68ch) is owned by the shell, not by the prose components.

### Minimal skeleton

```mdx
import { ArticleShell } from "@/components/articles/ArticleShell";

<ArticleShell slug="my-essay">

## First Section

Body copy. Just markdown - **strong**, *em*, [links](https://example.com), lists, and
blockquotes are all themed for you.

## Second Section

More prose.

</ArticleShell>
```

Add the matching registry entry:

```ts
{
  slug: "my-essay",
  title: "My Essay",
  summary: "A one-line description of the piece.",
  topic: "Economics",
  date: "2026-06-09",
  readingMinutes: 6,
  interactive: false,
  status: "published",
},
```

## 2. Embed a simulator as a figure

The live example is `app/articles/market-structure/page.mdx`. The pattern:

```mdx
import { ArticleShell } from "@/components/articles/ArticleShell";
import { Figure } from "@/components/articles/Figure";
import StiglerBarrierMarketSimulator from "@/components/visuals/StiglerBarrierMarketSimulator";

<ArticleShell slug="market-structure">

## Barriers to Entry

...prose...

<Figure bleed label="Interactive" caption="Drag your firm's variable and fixed costs and watch who survives the shakeout.">

<StiglerBarrierMarketSimulator />

</Figure>

## Next Section

</ArticleShell>
```

### `<Figure>` API (`components/articles/Figure.tsx`)

| Prop | Type | Role |
|---|---|---|
| `children` | `ReactNode` | The figure content (a sim, image, chart...). |
| `caption` | `ReactNode` | Optional `<figcaption>` text below the content. |
| `bleed` | `boolean` (default `false`) | When true, the figure escapes the reading measure to a wide instrument area. |
| `label` | `string` | Optional mono eyebrow above the caption, e.g. `"Interactive"` or `"FIGURE 1"`. |

**bleed vs inline:** use `bleed` for wide instruments (simulators, large charts) that need
room - it breaks out to the viewport edges via the `.article-bleed` utility and caps at
`max-w-[1400px]` with padding. Bleed derives viewport width from `--vw` (set on mount,
excludes the scrollbar) so it never introduces a horizontal scrollbar. Omit `bleed` for a
small figure that belongs inside the ~68ch column.

**Caption convention:** the caption tells the reader **what to do** ("Drag the cost
sliders and watch who survives"), not just what it is.

**Reduced motion:** the figure animates opacity/translate on mount under normal motion;
under `prefers-reduced-motion: reduce` it renders fully visible immediately (no opacity
gate, no animation). It uses `animate` (not `whileInView`) so it always resolves to
visible, even in headless/background renders.

### The client-island wrapper (why it exists)

A simulator is heavy client code (`useState`, d3, framer-motion). MDX is rendered server-
side by default, so the sim needs a **client boundary**. The boundary is a thin wrapper,
not the sim itself:

- The sim lives at `interactive-visuals/<Name>.jsx` and is **never edited for the embed**.
- A thin `"use client"` wrapper at `components/visuals/<Name>.tsx` re-exports its default:

```tsx
"use client";

// Thin client-boundary wrapper. The .jsx is left untouched; we only re-export it so
// MDX can embed it as an interactive island.
export { default } from "../../interactive-visuals/<Name>.jsx";
```

- The MDX file imports the **wrapper** (`@/components/visuals/<Name>`), never the raw `.jsx`.

This keeps the heavy `.jsx` free of `"use client"` ceremony and lets the wrapper own the
client boundary. The wrapper is unit-guarded (`tests/unit/visuals.test.tsx`) to prove the
`@/` alias + re-export wiring mounts.

## 3. Build or migrate a theme-native simulator

This is the most important section for future sim work.

> **The rule:** SIMULATION MATH stays in `interactive-visuals/*.jsx` and is never changed
> for presentation. The d3 **geometry** (scales, positioning, hit-testing) also stays.
> Only **presentation** changes: layout chrome, controls, readouts, and colors swap to the
> shared tokens and primitives. Every state and number must compute byte-identically
> before and after.

### Token contract

Defined in `app/globals.css` (both `[data-theme="phosphor"]` and `[data-theme="ledger"]`)
and mapped to Tailwind in `tailwind.config.ts`. Use these names; never hardcode colors.

| Token | Tailwind class | Role |
|---|---|---|
| `--bg` | `bg-bg` / `text-bg` | Page background; also the ink color *on* an accent fill. |
| `--surface` | `bg-surface` | Recessed control/track surface (sliders, selects, tab tracks). |
| `--panel` | `bg-panel` | The instrument-panel field (the sim's own card surface). |
| `--ink` | `text-ink` | Headings, emphasized values, the user's own series. High contrast. |
| `--body` | `text-body` | Running prose and standard readable text (>=4.5:1 on `bg`). |
| `--muted` | `text-muted` | Genuinely secondary labels, captions, axis text, recessive series. |
| `--accent` | `text-accent` / `bg-accent` | Brand teal; CTAs, links, the user's emphasized marks. |
| `--grid-line` | `border-grid-line` | Hairline borders, dividers, gridlines. |
| `--positive` | `text-positive` | Gains (use via `deltaTone`). |
| `--danger` | `text-danger` | Losses (use via `deltaTone`). |

CSS utilities also available: `.copy-scrim` (legibility vignette behind copy over the
canvas) and `.article-bleed` (the full-bleed breakout used by `Figure bleed`).

### Primitive catalog

Read the source files for the exact, current signatures; this is what they export today.

#### `SimFrame` - `components/sim/SimFrame.tsx`

The instrument panel that wraps a sim or a sub-view. Fills its container (never
`min-h-screen`): a `panel` field on a hairline `grid-line` border, rounded. Optional
header lays an eyebrow + title on the left and the `toolbar` slot on the right.

```ts
SimFrame({
  title?: string;       // rendered in the display face
  eyebrow?: string;     // mono uppercase eyebrow above the title
  toolbar?: ReactNode;  // right-aligned header controls (Reset, mode toggles, select)
  children: ReactNode;
  className?: string;
})
```

#### `SimSlider` - `components/sim/SimSlider.tsx` (`"use client"`)

A themed range control: label (+ optional hint) on the left, a value chip on the right, an
accent-tinted slider below. The displayed value mirrors the source sim (up to 2 fraction
digits when `step < 1`, else 0) wrapped in `prefix`/`suffix`.

```ts
SimSlider({
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  suffix?: string;   // appended, e.g. "%"
  prefix?: string;   // prepended, e.g. "$"
  hint?: string;     // helper text under the label
  // Comparison props are PAIRED - pass BOTH or NEITHER:
  comparisonLabel?: string;   // e.g. "Market avg c"
  comparisonValue?: string;   // pre-formatted, e.g. formatMoney(avg, 2)
})
```

With both comparison props set, the value chip becomes a two-cell "User | comparison"
readout. The pairing is enforced by the type: you cannot pass one without the other.

#### `SimReadout` / `SimReadoutRow` - `components/sim/SimReadout.tsx`

`SimReadout` is a single quiet readout: mono caption, large tabular value, optional
sublabel. **Deliberately not an icon+heading+text card** - it is the intentional
replacement for the banned hero-metric card grid (no surface, no border, no icon).

```ts
SimReadout({
  label: string;     // short uppercase mono caption
  value: string;     // PRE-FORMATTED via lib/sim/format helpers
  delta?: number;    // when present, value is toned via deltaTone: >=0 positive, <0 danger
  sublabel?: string; // genuinely secondary context under the value
})

SimReadoutRow({ children: ReactNode; className?: string })
```

`SimReadoutRow` lays its `SimReadout` children in a responsive 2->4 column grid (a single
quiet strip). It uses a grid, not flex-wrap, so divider borders never mis-apply to the
first item of a wrapped row.

#### `SimButton` - `components/sim/SimControls.tsx` (`"use client"`)

Themed action button. Extends native `<button>` attributes (minus `className`, which is
merged). Defaults `type="button"`.

```ts
SimButton({
  variant?: "solid" | "outline" | "ghost";  // default "solid"
  children: ReactNode;                       // place a leading icon first
  className?: string;
  ...buttonHTMLAttributes                    // onClick, disabled, etc.
})
```

`solid` = accent CTA (`bg-accent text-bg`), `outline` = bordered secondary, `ghost` =
borderless tertiary.

#### `SimSelect` - `components/sim/SimControls.tsx`

Themed native `<select>` on `surface` with a hairline border and pill shape. Extends native
`<select>` attributes (minus `className`); pass `<option>`s as children plus
`value` / `onChange`.

```ts
SimSelect({ children: ReactNode; className?: string; ...selectHTMLAttributes })
```

#### `SimTabs` / `SimToggleButton` - `components/sim/SimControls.tsx`

A segmented control (not an ARIA tab-panel system). `SimTabs` is a recessed `surface`
track using `role="group"` + `aria-label`; `SimToggleButton` is one pill inside it using
`aria-pressed` (active = accent fill on `bg` ink; inactive = muted text -> ink on hover).

```ts
SimTabs({ label?: string; children: ReactNode; className?: string })

SimToggleButton({
  active: boolean;
  children: ReactNode;
  className?: string;
  ...buttonHTMLAttributes   // onClick, etc.
})
```

### `chart.ts` usage - `components/sim/chart.ts`

Only **colors** come from here. d3 scales, positioning, and hit-testing stay in the sim.

- **`CHART`** - Tailwind class strings for chart chrome (apply via `className`):
  - `CHART.gridLine` - dashed gridlines/hairlines (`border-grid-line border-dashed`).
  - `CHART.axisLine` - **solid** axis baseline (`border-grid-line border-solid`).
  - `CHART.axisText` - axis tick labels / secondary chart text (`text-muted`).
  - `CHART.userSeries` / `rivalSeries` / `tailSeries` - series text colors.
  - `CHART.tooltipSurface` - the floating tooltip card surface.
  - Note: `gridLine` is dashed, `axisLine` is solid - pick the right one per element.

- **`CHART_COLOR`** - raw CSS-var expressions for inline use where a class won't reach
  (SVG `fill`/`stroke`, rgba dot fills, `style={{ background: CHART_COLOR.accent }}`):
  `accent`, `ink`, `muted`, `gridLine`, `positive`, `danger`, plus pre-mixed translucent
  fills `userFill` / `rivalFill` / `tailFill`. These reference live theme vars, so they
  re-resolve when `data-theme` flips.

- **`tint(cssVar, alpha)`** - build a translucent tint of a theme var at a given alpha
  (0-1), for d3-driven fills needing variable opacity, e.g.
  `tint(CHART_COLOR.muted, 0.4)`.

**Numbers:** route all formatting through `lib/sim/format.ts` - `formatPct(value, digits=1)`,
`formatMoney(value, digits=2)`, `formatCompact(value)` (SI prefix, "G"->"B"; all return
`"--"` for non-finite). Use `deltaTone(value)` (`"positive"` for `>= 0`, else `"danger"`)
for gain/loss coloring rather than hand-written conditionals.

### Migration checklist

Derived from the Stigler migration (the only sim migrated so far, the template). Keep all
math and geometry byte-identical; this is presentation-only.

- [ ] Drop the page wrapper: remove `min-h-screen`, gradient backgrounds, and any
      `max-w-[...]` page framing. The sim now lives inside a `Figure` and fills its
      container.
- [ ] Wrap the panel(s) in `SimFrame` (eyebrow/title/toolbar slots) instead of bespoke
      cards.
- [ ] Swap bespoke controls for primitives: `Slider` -> `SimSlider`, `Card` -> `SimFrame`,
      `Button` -> `SimButton`, `<select>` -> `SimSelect`, tabs/toggles -> `SimTabs` +
      `SimToggleButton`.
- [ ] Replace the 4-up `MetricCard` grid with one `SimReadoutRow` of `SimReadout`s (no
      icon cards).
- [ ] Recolor charts via `CHART` (class strings), `CHART_COLOR` (inline SVG/style fills),
      and `tint(...)` (variable opacity). Keep all d3 scales/geometry unchanged.
- [ ] Replace **all** `slate-*` / `text-white` / `bg-white` / `emerald-*` / `rose-*` /
      `amber-*` / hex colors with tokens. Confirm none remain (see grep below).
- [ ] Import `lib/sim/format.ts` helpers (`formatPct`/`formatMoney`/`formatCompact`/
      `deltaTone`) instead of inlining number formatting / sign logic.
- [ ] Create/keep the `"use client"` wrapper at `components/visuals/<Name>.tsx`; import
      that from MDX (never the raw `.jsx`).
- [ ] Verify **both** themes in the browser - Phosphor and Ledger must both read as
      intentional, native instruments.
- [ ] Confirm the math is unchanged: every readout and chart value computes identically.

Grep to confirm no legacy colors remain (use word boundaries so `-translate-` etc. do not
false-match `slate`/`white`):

```sh
grep -nE '\b(slate|emerald|rose|amber)-[0-9]|\b(bg|text|border)-white\b|#[0-9a-fA-F]{3,6}\b' \
  "interactive-visuals/<Name>.jsx"
```

(The migrated Stigler sim returns no real matches; only loose substring greps surface
false positives from utilities like `-translate-x`.)

### Remaining sims to migrate

Three simulators are wired with `"use client"` wrappers in `components/visuals/` but their
underlying `.jsx` is **not yet migrated** (still slate/white light-mode). Each should
follow the checklist above:

- [ ] `interactive-visuals/Entry Barriers Market Dynamics.jsx`
      (wrapper: `components/visuals/EntryBarrierMarketDynamics.tsx`)
- [ ] `interactive-visuals/imitability-differentiation-simulator.jsx`
      (wrapper: `components/visuals/SupplySideCopyabilitySimulator.tsx`)
- [ ] `interactive-visuals/Network Production Market Simulator.jsx`
      (wrapper: `components/visuals/NetworkProductionMarketSimulator.tsx`)

## 4. Theming & accessibility rules

- **Body copy** uses `text-body` or `text-ink` (both >=4.5:1 on `bg` in both themes).
  Reserve `text-muted` for genuinely secondary labels (captions, axis ticks, metadata) -
  never running prose.
- **Both themes are first-class.** Anything you add must read as intentional in Phosphor
  and Ledger. Verify in the browser by toggling.
- **Reveals animate on mount, never gate visibility.** Use `initial`+`animate` (not
  `whileInView`) so content always resolves to visible even in headless/background renders.
  Under `prefers-reduced-motion: reduce`, render fully visible immediately with no
  animation (mirror the pattern in `ArticleShell` and `Figure`).
- **Decorative canvas is `aria-hidden`** (see `IndexCanvas`); the background field never
  carries content for assistive tech.
- **Focus states:** primitives ship visible `focus-visible` rings against `panel`/`bg`.
  Keep them.

## 5. Testing & gates

- **Unit-test pure logic** with Vitest (`npm run test`): registry behavior
  (`tests/unit/articleRegistry.test.ts`) and format helpers
  (`tests/unit/simFormat.test.ts`). The wrapper mount is guarded in
  `tests/unit/visuals.test.tsx`.
- **E2E with Playwright** (`npm run test:e2e`). Pattern: `tests/e2e/article.spec.ts`. It
  asserts MDX prose renders, the sim island hydrates (a control like Reset is present),
  the simulator stays hydrated across a theme toggle, reduced-motion content is not gated,
  and the **both-theme legibility lock** (prose-on-background contrast >=4.5:1 in Phosphor
  and Ledger). Index coverage lives in `tests/e2e/articles-index.spec.ts`.
- **Port:** the Playwright `webServer` builds and serves on `E2E_PORT` (default `3100`).
  Set `E2E_PORT` to avoid clashing with a running dev server.
- **Gate:** run `node evals/judge.mjs --all` and get a `done` verdict before claiming
  completion. Deterministic gates (typecheck/lint/unit/e2e/build) are supreme.

When adding a sim, extend the e2e coverage to assert it hydrates and stays legible in both
themes - mirror the assertions in `tests/e2e/article.spec.ts`.
