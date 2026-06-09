// harness/evals/lib/checks.mjs
import { spawnSync } from "node:child_process";
import { SCHEMAS } from "./schema.mjs";

/**
 * @typedef {{ name: string, command: string, optional?: boolean }} Gate
 * @typedef {{ exitCode: number, output: string }} GateRun
 * @callback GateRunner
 * @param {Gate} gate
 * @returns {GateRun}
 */

/**
 * @param {Gate[]} gates
 * @param {GateRunner} runner
 * @returns {{ schema: string, version: number, passed: boolean, gates: any[] }}
 */
export function runGates(gates, runner) {
  const results = gates.map((g) => {
    const { exitCode, output } = runner(g);
    return {
      name: g.name,
      command: g.command,
      exit_code: exitCode,
      passed: exitCode === 0,
      optional: !!g.optional,
      output,
    };
  });
  const passed = results.every((r) => r.optional || r.passed);
  return { ...SCHEMAS.deterministic, passed, gates: results };
}

/**
 * Real gate runner: executes a gate command in a shell and captures result.
 * Gate commands come from the project's own checks.json (trusted config), so
 * shell execution is acceptable here.
 * @param {{ name: string, command: string }} gate
 * @returns {{ exitCode: number, output: string }}
 */
export function shellGateRunner(gate) {
  const res = spawnSync(gate.command, { shell: true, encoding: "utf8" });
  const stdout = res.stdout || "";
  const stderr = res.stderr || "";
  const exitCode = typeof res.status === "number" ? res.status : 1;
  return { exitCode, output: stdout + stderr };
}
