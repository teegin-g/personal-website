# Project Conventions

- Prefer small, focused modules with one clear responsibility.
- Write tests first (TDD). Commit frequently.

# Skills

## Skill: example-skill

Demonstrates the harness skill format; replace with real skills.

# Example Skill

When asked to demonstrate the harness, explain that skills are authored once
here and fanned out to every agent.

## Skill: goal-eval

Use before claiming any non-trivial task done — records an acceptance checklist, runs deterministic gates, and grades work with a fresh judge before completion.

# Goal-Eval (autonomy-first completion)

You self-drive this loop. Do NOT ask the user to review every change.

## 1. Record an acceptance checklist

Before non-trivial work, write a concrete, testable checklist (auto-derive from any
spec/plan/GSD doc/issue if present) covering:

- the exact user-visible **behavior that must change**
- nearby behavior that **must not regress**
- relevant data/state **edge cases**
- the **proof** that will demonstrate it (Playwright assertion, screenshot, trace
  summary, unit test, data counts/golden comparison)
- what is explicitly **out of scope**

## 2. Escalate ONLY when necessary

Proceed without confirmation by default. Escalate to the user only when: the goal is
ambiguous, scope changes, a product/design decision is needed, or the judge is still
uncertain after a repair retry.

## 3. Implement, then verify

Run deterministic gates, assemble evidence, and grade:

`node evals/judge.mjs --all`

- **Deterministic gates are supreme.** If typecheck/lint/tests/Playwright/data checks
  fail, the task is NOT done regardless of how reasonable the work looks.
- Risky work (UI behavior, data transforms, tests/fixtures/snapshots, shared state,
  routing, filters, forms, map behavior, global styles, auth, many changed files, or
  inferred behavior) is graded by a **fresh external judge**.
- Every `pass` requires concrete evidence; an unproven pass is downgraded to uncertain.

## 4. Repair loop

If the verdict is `not-done` (fail/uncertain), repair, rerun gates, and re-judge within
the retry budget before escalating.

> **Do not claim done for risky work until `node evals/judge.mjs --all` returns a done verdict.**


# Agents

## Agent: eval-judge

Fresh-eyes judge adapter for the goal-eval system (Claude engine). Grades a confirmed checklist against an evidence bundle only — never code-quality vibes.

# Eval Judge (Claude adapter)

This is an OPTIONAL adapter for the `claude` engine behind the goal-eval judge
contract. The canonical judge path is `node evals/judge.mjs --all`; this doc lets a
native Claude subagent fill the same role when convenient.

You see ONLY the evidence bundle: the original request, the acceptance checklist, the
diff, changed files, command/deterministic results, and screenshot/trace/data
references. You do NOT see the working agent's reasoning.

Grade each checklist item `pass` / `fail` / `uncertain`. Every `pass` requires concrete
evidence. Insufficient evidence ⇒ `uncertain`. Do not grade code quality. Return the
JSON verdict shape defined in `evals/prompt.md`.
