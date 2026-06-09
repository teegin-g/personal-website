// harness/evals/adapters/codex.mjs
import { runProcess as defaultRun } from "../lib/proc.mjs";
import { extractJson } from "./shared.mjs";

// CLI flags are isolated here so a codex CLI change touches only this file.
function buildArgs(promptPath) {
  return ["exec", "--sandbox", "read-only", "--prompt-file", promptPath];
}

export const codexAdapter = {
  engine: "codex",
  /**
   * @param {{ promptPath: string, input: string }} ctx
   * @param {{ runProcess?: typeof defaultRun }} [deps]
   */
  async invoke(ctx, deps = {}) {
    const run = deps.runProcess ?? defaultRun;
    const { exitCode, stdout, stderr } = await run("codex", buildArgs(ctx.promptPath), { input: ctx.input });
    if (exitCode !== 0) throw new Error("codex judge exit " + exitCode + ": " + stderr);
    return JSON.parse(extractJson(stdout));
  },
};
