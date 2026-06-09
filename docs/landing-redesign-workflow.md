# Landing Redesign — Workflow Orchestration Plan

Turns the approved design brief into a structure runnable with Claude's **Workflow** tool
(ultracode / dynamic fan-out). Read alongside the brief in the conversation.

## Operating principle

A single-scroll page shares state (`app/page.tsx`, `app/globals.css` tokens, one visual
rhythm). Parallel agents that all touch shared files produce a Frankenpage. So:

- **Fan out** where work is independent and benefits from many perspectives:
  visual-direction exploration, adversarial review.
- **Stay sequential** for integration: the orchestrator wires sections into the page once,
  preserving coherence. Parallel *build* is limited to **file-isolated modules** (pure libs,
  self-contained section components), each in its own file → no write conflicts.
- The orchestrator (main loop) **reads each workflow's result and decides the next phase**.
  This is several workflows in sequence, not one mega-run. Human-in-the-loop between phases.

## Hard inputs required before build (page fails the brief without them)

- **Contact destinations** (brief §8 forbids fake links) — RESOLVED:
  - Email: `teegingroves@gmail.com`
  - Substack: `https://substack.com/@economos` (replaces placeholder `substack.com`)
  - GitHub: `https://github.com/teegin-g`
  - LinkedIn: `https://www.linkedin.com/in/teegin-groves-3535a7200/`
  - (X / Twitter: none provided — omit unless added later.)
- **Identity line** — RESOLVED. Casual, self-aware voice (NOT a polished quant bio). Use verbatim:
  > I'm 24 and I write about whatever I find interesting. This whole site is mostly an
  > excuse to make you subscribe to my Substack.
  - **CTA treatment:** joke-in-copy + soft link. The word "Substack" in that line IS the link
    (→ `https://substack.com/@economos`). Do NOT add a separate Subscribe button in the hero;
    the self-awareness is the call-to-action. Keep the voice light throughout the page — no
    corporate/recruiter register, no buzzwords.
- **Portrait** — `4BCD4075-65FA-45F3-81E7-6EBA3D0B85D5_4_5005_c.jpeg` in repo root → move to
  `public/teegin.jpg`, optimize (portrait 360×480; consider a 2× export if a larger original exists).

## Invariants every agent must honor (paste into each agent prompt)

- Two first-class themes Phosphor (night, default) / Ledger (day); tokens in
  `app/globals.css`, mirrored as literal RGBA where canvas/WebGL needs them. Keep in sync.
- Fonts unchanged: Bricolage Grotesque (display) / Geist (body) / Spline Sans Mono
  (numeric readouts + short labels ONLY).
- Display clamp ceiling ≤ 6rem; letter-spacing ≥ -0.04em; `text-wrap: balance` on h1–h3.
- Body text ≥ 4.5:1 contrast both themes; large ≥ 3:1.
- `prefers-reduced-motion`: scene → one static settled frame; copy crossfades; content
  NEVER gated on JS firing.
- Mono is an instrument readout, NOT a kicker on every section (break the current reflex).
- VOICE: casual, self-aware, 24-year-old who writes for fun — NOT a polished quant/recruiter
  bio. Light and a little funny. The hero literally jokes that the site is a Substack shill.
  Don't sand this into corporate copy anywhere on the page.
- Bans: no decorative particles, no hero-metric template, no identical icon-card grids, no
  side-stripe borders, no gradient text, no per-section uppercase eyebrows, no em dashes.
- Architecture: ref-driven `useEffect` rAF loop, no per-frame React render. three.js
  dynamically imported (no first-paint block). WebGL-unsupported/context-lost → graceful
  fallback (static frame or existing 2D field), never blank canvas.
- TDD: pure logic unit-tested (Vitest), behavior Playwright-tested, `node evals/judge.mjs
  --all` must return `done`.

---

## PHASE 0 — Inline prep (orchestrator, no workflow)

Cheap, sequential, shared-file. Do directly, not via fan-out.

1. `npm i three @types/three`.
2. Move portrait → `public/teegin.jpg`; verify it loads.
3. Confirm hard inputs above are filled; if links missing, STOP and ask.
4. Read current `page.tsx`, `globals.css`, `Beat.tsx`, `LandingNav.tsx`, `EquilibriumField.tsx`,
   `fieldEngine.ts`, `scrollProgress.ts` (already done in conversation — re-confirm if stale).

## PHASE 1 — Hero concept exploration (Workflow: judge-panel)

Goal: pick the strongest *equilibrium-surface* hero concept before building it.

```
phase('Explore')
const CONCEPTS = [
  'lit displaced-mesh terrain: agents settle into valleys; cursor lifts a gravity well',
  'wireframe oscilloscope surface: scanline sweep, agents as glowing nodes on the grid',
  'particle-cloud condensing onto an invisible equilibrium manifold; shock scatters it',
]
// 3 independent design proposals (spec + threejs approach + why-it-means-something), schema'd
const proposals = await parallel(CONCEPTS.map(c => () =>
  agent(`Propose a three.js hero realizing: ${c}. Honor invariants. Return scene graph,
          materials, interaction model, perf tiering, reduced-motion frame.`,
         {phase:'Explore', schema: PROPOSAL_SCHEMA})))
phase('Judge')
// 3 judges score each on: meaning, wow, perf-realism, brand-fit, build-risk
const verdicts = await parallel(proposals.filter(Boolean).map(p => () =>
  agent(`Score this hero proposal on meaning/wow/perf/brand-fit/risk (1-5 each) + risks.`,
         {phase:'Judge', schema: VERDICT_SCHEMA})))
return { proposals, verdicts }
```

Orchestrator: read scores, synthesize a winner (graft best ideas from runners-up),
present a 1-paragraph chosen-direction summary. **Pause for user nod.**

## PHASE 2 — Build modules (Workflow: file-isolated parallel build)

Only TRULY independent files run in parallel. Each agent owns ONE new file, writes its test
first (TDD), does not touch shared files.

```
phase('Build')
const MODULES = [
  {file:'lib/hero/surfaceEngine.ts',   spec:'pure: heightfield, gravity well, shock, settle. Unit-tested.'},
  {file:'lib/hero/surfaceEngine.test.ts', spec:'Vitest for surfaceEngine (write WITH the engine)'},
  {file:'components/hero/EquilibriumSurface.tsx', spec:'three.js renderer over surfaceEngine; dyn import; reduced-motion frame; context-lost fallback'},
  {file:'components/sections/About.tsx', spec:'portrait (public/teegin.jpg) + first-person intro in the casual 24-yo voice; asymmetric; scrim not card; "Substack" is the soft-link CTA → substack.com/@economos'},
  {file:'components/sections/Work.tsx',  spec:'Market Structure essay featured + 4 live sim previews + Projects "coming soon"'},
  {file:'components/sections/Close.tsx', spec:'real links: mailto:teegingroves@gmail.com · https://substack.com/@economos · https://github.com/teegin-g · https://www.linkedin.com/in/teegin-groves-3535a7200/ ; upgraded LandingNav; Projects entry labeled "coming soon" (no 404)'},
]
const built = await parallel(MODULES.map(m => () =>
  agent(`Create ${m.file}: ${m.spec}. Honor ALL invariants. Self-contained; do NOT edit
          page.tsx or globals.css. Return file path + 1-line summary.`,
         {phase:'Build', isolation:'worktree', schema: BUILT_SCHEMA})))
return built
```

Note `isolation:'worktree'` ONLY if running them truly concurrently with overlapping git
state; otherwise omit (cheaper) since each writes a distinct new file. Engine + its test
should be ONE agent (TDD pairing), not two.

## PHASE 3 — Integration (orchestrator, sequential, NO workflow)

The coherence step. Done once, by hand:
- Wire sections into `app/page.tsx` in narrative order; swap `EquilibriumField` →
  `EquilibriumSurface`; keep scroll-progress plumbing.
- Add any new tokens to `globals.css` (single source); sync WebGL literal colors.
- Update `LandingNav`/remove dead `/projects` link per "coming soon" decision.
- Run unit + e2e locally; fix wiring bugs. Commit per working step.

## PHASE 4 — Adversarial review + verify (Workflow: review→verify pipeline)

```
phase('Review')
const DIMS = [
  {k:'a11y',     p:'contrast both themes, keyboard nav, aria-hidden canvas, reduced-motion'},
  {k:'perf',     p:'bundle cost of three, first paint, rAF discipline, mobile tiering, tab-hidden pause'},
  {k:'brand',    p:'AI-slop test, meaning-not-decoration, no banned patterns, theme parity'},
  {k:'responsive',p:'hero + sections at 360/768/1280/1920; heading overflow; portrait crop'},
]
const results = await pipeline(DIMS,
  d => agent(`Review the shipped landing for ${d.k}: ${d.p}. Use the browser. Return findings.`,
             {phase:'Review', schema: FINDINGS_SCHEMA}),
  review => parallel((review.findings||[]).map(f => () =>
    agent(`Adversarially verify finding: ${f.title}. Real & reproducible? Default refuted if unsure.`,
           {phase:'Verify', schema: VERDICT_SCHEMA}).then(v => ({...f, verdict:v})))))
return results.flat().filter(Boolean).filter(f => f.verdict?.isReal)
```

Orchestrator: fix confirmed findings inline, re-run gates, then `node evals/judge.mjs --all`.

## Phase → tool map

| Phase | Tool | Parallel? | Why |
|---|---|---|---|
| 0 Prep | inline | no | shared files, cheap |
| 1 Explore hero | Workflow judge-panel | yes | independent concepts, wide solution space |
| 2 Build modules | Workflow / inline | file-isolated only | distinct new files; shared files excluded |
| 3 Integration | inline | no | coherence, single source of truth |
| 4 Review | Workflow pipeline | yes | independent dimensions, adversarial verify |

## Notes on running with Workflow

- Workflow runs in background; orchestrator reads each result, then launches the next.
  Do NOT chain all four into one script — you lose the human checkpoints.
- Budget-scale fan-out width to the `+Nk` directive if given (more concepts, more judges).
- Schemas (PROPOSAL/VERDICT/BUILT/FINDINGS) defined inline per script; keep them small.

---

## How to run this plan

Two ways to drive it, depending on which mode you want. **Both require opting into
multi-agent orchestration** — the Workflow tool only fires when you've explicitly asked for
it (say "run a workflow" / "use ultracode" / "fan out agents"), or ultracode is on.

### Option A — Ultracode (standing opt-in, runs phases for you)

Best when you want Claude to drive the whole sequence and you just approve at the
checkpoints.

1. Open a fresh Claude Code session in this repo.
2. Turn ultracode **on** (your harness's ultracode toggle). A system reminder confirms it.
   While on, Claude authors and runs a workflow per substantive phase by default.
3. Paste this kickoff:
   > "Execute `docs/landing-redesign-workflow.md`. Ultracode is on. Run Phase 0 inline,
   > then Phase 1 as a workflow. Stop after each phase for my approval before the next.
   > Don't chain all phases into one script — I want the checkpoints."
4. After Phase 1 returns, Claude shows the winning hero concept → you nod → Phase 2, etc.
5. Turn ultracode **off** when done so later sessions don't fan out by reflex.

### Option B — Dynamic workflows (you trigger each phase explicitly)

Best when you want tight control: you decide when each fan-out runs, ultracode stays off.

1. Fresh session in this repo (ultracode off).
2. For each phase, give an explicit workflow instruction. Phase 1 example:
   > "Run a workflow: Phase 1 (hero concept exploration) from
   > `docs/landing-redesign-workflow.md`. Use the judge-panel script in that file —
   > 3 concept proposals, 3 judges scoring each, return proposals + verdicts. Honor the
   > invariants section."
3. Read the result, decide the winner with Claude, then trigger Phase 2 the same way:
   > "Now run Phase 2 (build modules) as a workflow, file-isolated per the plan."
4. Phases 0 and 3 are **inline, no workflow** — just ask Claude to do them directly
   ("do Phase 0 prep", "do Phase 3 integration"). Don't request a workflow for those;
   they touch shared files and must stay sequential.
5. Phase 4 (review): "Run the Phase 4 review→verify pipeline workflow from the plan."

### Tips for either mode

- **Iterate on a script without re-pasting it:** every Workflow run saves its script to a
  file and returns the path. To tweak a phase, edit that file and re-run with
  `{scriptPath: "<path>"}`. To resume after a stop/edit, re-run with
  `{scriptPath, resumeFromRunId}` — unchanged agent calls return cached results instantly.
- **Scale fan-out width with budget:** prefix a phase with a token target (e.g. "+500k") to
  get more concepts / more judges / a deeper review. Without a target the scripts use their
  default widths (3 concepts, 3 judges, 4 review dims).
- **Watch progress:** `/workflows` shows the live agent tree while a phase runs.
- **The checkpoints are the point.** Resist "run all four phases unattended." The value of
  this structure is that you (and Claude) read each phase's output and steer the next. A
  cohesive page comes from the synthesis between phases, not from raw parallelism.
- **First-input gate:** all soft inputs are now RESOLVED in this doc (links, identity line +
  CTA treatment, voice). The only mechanical prep left is Phase 0 moving the portrait into
  `public/teegin.jpg`. Nothing blocks the run.
