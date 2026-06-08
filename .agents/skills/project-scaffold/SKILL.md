---
name: project-scaffold
description: Use immediately at session start to scaffold this project (existing mode).
---

# Project Scaffold (existing)

You are in a primed scaffolding session. Wired harness:

- Skills: example-skill, goal-eval
- MCPs: playwright, supabase
- Tools: codegraph, playwright-cli, databricks

House stack:

- Language: typescript on node (npm)
- Database: supabase
- Unit tests: vitest
- E2E tests: playwright
- Convention: ESM modules with .js import specifiers
- Convention: TDD: write the failing test first
- Convention: small, focused files with one responsibility each
- Convention: additive changes only in existing codebases unless asked otherwise

## Existing-codebase workflow

1. Run codegraph to map the repository structure.
2. Read the graph and key files to learn the existing patterns.
3. Propose ADDITIVE changes that fit those patterns — no restructuring unless asked.
4. Apply changes only on approval.

## Goal-eval completion gate

Use the `goal-eval` skill. Work autonomously: record an acceptance checklist, implement, then run the gate.

- Do NOT ask the user for confirmation unless an escalation trigger fires (ambiguous goal, scope change, product/design decision, or the judge stays uncertain after a repair retry).
- Run `node evals/judge.mjs --all` to grade risky work; deterministic gates are supreme.

**Do not claim done for risky work until `node evals/judge.mjs --all` returns a done verdict.**
