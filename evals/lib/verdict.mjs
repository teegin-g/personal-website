// harness/evals/lib/verdict.mjs
import { SCHEMAS } from "./schema.mjs";

const RESULTS = new Set(["pass", "fail", "uncertain"]);

/**
 * Validate the raw grading output produced by an engine or self-grade file.
 * @param {any} raw
 * @returns {{ ok: boolean, errors: string[], value?: any }}
 */
export function validateJudgeOutput(raw) {
  const errors = [];
  if (!raw || !Array.isArray(raw.checklist)) {
    errors.push("checklist must be an array");
    return { ok: false, errors };
  }
  raw.checklist.forEach((item, i) => {
    if (!item || typeof item.id !== "string") errors.push("item[" + i + "].id must be a string");
    if (!item || !RESULTS.has(item.result)) errors.push("item[" + i + "].result must be pass|fail|uncertain");
    if (!item || !Array.isArray(item.evidence)) errors.push("item[" + i + "].evidence must be an array");
  });
  return { ok: errors.length === 0, errors, value: errors.length === 0 ? raw : undefined };
}

const UI_PROOF = new Set(["screenshot", "playwright", "assertion"]);
const DATA_PROOF = new Set(["data", "schema", "counts", "golden"]);

const UI_EVIDENCE = /screenshot|\.png|trace|playwright|assert/i;
const DATA_EVIDENCE = /count|rows?|null|dup|golden|schema|\.csv|before|after/i;

/**
 * Downgrade any pass that is not backed by domain-appropriate evidence.
 * Never upgrades a fail/uncertain. Matches checklist items by id for proof type.
 * @param {{ id: string, result: string, evidence: string[], notes?: string }[]} graded
 * @param {{ id: string, type?: string, proof?: string }[]} items
 * @returns {any[]}
 */
export function applyEvidenceRules(graded, items) {
  const byId = new Map(items.map((it) => [it.id, it]));
  return graded.map((g) => {
    if (g.result !== "pass") return g;
    const item = byId.get(g.id) ?? {};
    const evidence = Array.isArray(g.evidence) ? g.evidence : [];
    const joined = evidence.join(" ");

    if (evidence.length === 0) {
      return { ...g, result: "uncertain", notes: appendNote(g.notes, "pass requires evidence") };
    }
    if (UI_PROOF.has(item.proof) && !UI_EVIDENCE.test(joined)) {
      return { ...g, result: "uncertain", notes: appendNote(g.notes, "UI pass requires screenshot/trace/assertion") };
    }
    if (DATA_PROOF.has(item.proof) && !DATA_EVIDENCE.test(joined)) {
      return { ...g, result: "uncertain", notes: appendNote(g.notes, "data pass requires counts/comparison/golden") };
    }
    return g;
  });
}

function appendNote(existing, msg) {
  return existing ? existing + " | " + msg : msg;
}

/**
 * Combine deterministic results with graded checklist into a final verdict.
 * Deterministic gates are supreme: a failed gate forces not-done regardless of
 * checklist grades.
 * @param {{
 *   runId: string, engine: string,
 *   judgeMode: "external" | "self-grade" | "self-review-fallback",
 *   deterministic: { passed: boolean, gates: any[] },
 *   gradedChecklist: { id: string, result: string, evidence: string[], notes?: string }[],
 * }} input
 * @returns {any}
 */
export function mergeVerdict(input) {
  const { runId, engine, judgeMode, deterministic, gradedChecklist } = input;

  let verdict = "done";
  let reason = "passed";

  if (!deterministic.passed) {
    verdict = "not-done";
    reason = "deterministic-gate-failed";
  } else if (judgeMode === "self-review-fallback") {
    verdict = "not-done";
    reason = "no-external-judge";
  } else if (gradedChecklist.length === 0 || !gradedChecklist.every((g) => g.result === "pass")) {
    verdict = "not-done";
    reason = "checklist-incomplete";
  }

  const escalate = judgeMode === "self-review-fallback";

  return {
    ...SCHEMAS.verdict,
    run_id: runId,
    engine,
    judge_mode: judgeMode,
    deterministic,
    checklist: gradedChecklist,
    verdict,
    reason,
    escalate,
  };
}
