// harness/evals/judge.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyRisk } from "./lib/risk.mjs";
import { runGates as defaultRunGates, shellGateRunner } from "./lib/checks.mjs";
import { assembleBundle } from "./lib/bundle.mjs";
import { selectAdapter as defaultSelectAdapter } from "./adapters/index.mjs";
import { validateJudgeOutput, applyEvidenceRules, mergeVerdict } from "./lib/verdict.mjs";
import { assertSchema, SCHEMAS } from "./lib/schema.mjs";

/**
 * Run the full goal-eval flow: gates, risk classification, judge (external /
 * self-grade / self-review-fallback), then merge into a verdict written to
 * runDir/verdict.json. All side-effecting collaborators are injectable.
 * @param {object} ctx  { runDir, config, request, checklist, diff, changedFiles }
 * @param {object} [deps]
 * @returns {Promise<object>}
 */
export async function runAll(ctx, deps = {}) {
  const runGates = deps.runGates ?? defaultRunGates;
  const runner = deps.runner ?? (() => ({ exitCode: 0, output: "" }));
  const selectAdapter = deps.selectAdapter ?? defaultSelectAdapter;
  const warn = deps.warn ?? ((m) => process.stderr.write(m + "\n"));

  const gates = ctx.config.gates ?? [];
  const deterministic = runGates(gates, runner);

  const risk = classifyRisk(ctx.changedFiles, ctx.checklist && ctx.checklist.risk, ctx.config.risk);
  const adapter = risk.level === "risky" ? selectAdapter(ctx.config.engine) : null;

  let judgeMode;
  let rawOutput;

  if (risk.level === "risky" && adapter) {
    judgeMode = "external";
    const bundle = assembleBundle(ctx.runDir, {
      request: ctx.request,
      checklist: ctx.checklist,
      diff: ctx.diff,
      changedFiles: ctx.changedFiles,
      deterministic,
    });
    const input = fs.readFileSync(bundle.bundleTxtPath, "utf8");
    const promptPath = fileURLToPath(new URL("./prompt.md", import.meta.url));
    rawOutput = await adapter.invoke({ promptPath, input }, deps);
  } else if (risk.level === "risky" && !adapter) {
    judgeMode = "self-review-fallback";
    warn("WARNING: risky task but no judge engine configured -- using self-review fallback. This is degraded; escalate to a human.");
    rawOutput = readSelfGrade(ctx.runDir);
  } else {
    judgeMode = "self-grade";
    rawOutput = readSelfGrade(ctx.runDir);
  }

  const validation = validateJudgeOutput(rawOutput);
  if (!validation.ok) throw new Error("invalid judge output: " + validation.errors.join("; "));

  const items = (ctx.checklist && ctx.checklist.items) || [];
  const graded = applyEvidenceRules(rawOutput.checklist, items);
  const gradedById = new Map(graded.map((g) => [g.id, g]));
  const reconciled = items.map(
    (it) => gradedById.get(it.id) || { id: it.id, result: "uncertain", evidence: [], notes: "no grade returned for this item" },
  );

  const verdict = mergeVerdict({
    runId: ctx.config.run_id || path.basename(ctx.runDir),
    engine: ctx.config.engine,
    judgeMode,
    deterministic,
    gradedChecklist: reconciled,
  });

  fs.writeFileSync(path.join(ctx.runDir, "verdict.json"), JSON.stringify(verdict, null, 2) + "\n", "utf8");
  return verdict;
}

function readSelfGrade(runDir) {
  const p = path.join(runDir, "self-grade.json");
  if (!fs.existsSync(p)) return { checklist: [] };
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/**
 * @param {string[]} argv
 * @returns {{ phase: "all" | "run-checks" | "judge", engine?: string, runDir?: string }}
 */
export function parseArgs(argv) {
  const out = { phase: "all" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") out.phase = "all";
    else if (a === "--run-checks") out.phase = "run-checks";
    else if (a === "--judge") out.phase = "judge";
    else if (a === "--engine") out.engine = argv[++i];
    else if (a === "--run-dir") out.runDir = argv[++i];
  }
  return out;
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/**
 * File-loading CLI glue around runAll. Reads evals/judge.config.json + evals/checks.json
 * and the run dir artifacts. The --run-checks phase runs gates only.
 */
export async function main(argv) {
  const args = parseArgs(argv || process.argv.slice(2));
  const runDir = args.runDir || "evals/runs/latest";
  const config = loadJson("evals/judge.config.json");
  assertSchema(config, SCHEMAS.judgeConfig, "evals/judge.config.json");
  const checks = loadJson("evals/checks.json");
  assertSchema(checks, SCHEMAS.checks, "evals/checks.json");
  if (args.engine) config.engine = args.engine;
  config.gates = checks.gates;

  if (args.phase === "run-checks") {
    const deterministic = defaultRunGates(config.gates || [], shellGateRunner);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, "deterministic.json"), JSON.stringify(deterministic, null, 2) + "\n", "utf8");
    process.stdout.write("checks " + (deterministic.passed ? "passed" : "failed") + "\n");
    if (!deterministic.passed) process.exitCode = 1;
    return;
  }

  const checklist = loadJson(path.join(runDir, "checklist.json"));
  const request = fs.readFileSync(path.join(runDir, "request.md"), "utf8");
  const diff = fs.readFileSync(path.join(runDir, "diff.patch"), "utf8");
  const changedFiles = fs
    .readFileSync(path.join(runDir, "changed-files.txt"), "utf8")
    .split("\n")
    .filter(Boolean);

  const verdict = await runAll(
    { runDir, config, request, checklist, diff, changedFiles },
    { runner: shellGateRunner },
  );
  if (verdict.verdict !== "done") process.exitCode = 1;
  process.stdout.write(verdict.verdict + " (" + verdict.reason + ")\n");
}

const isMain = process.argv[1] && process.argv[1].endsWith("judge.mjs");
if (isMain) {
  main().catch((err) => {
    process.stderr.write(String((err && err.stack) || err) + "\n");
    process.exitCode = 1;
  });
}
