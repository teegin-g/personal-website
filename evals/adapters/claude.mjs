// harness/evals/adapters/claude.mjs
import { runProcess as defaultRun } from "../lib/proc.mjs";
import { extractJson } from "./shared.mjs";

function buildArgs(promptPath) {
  return ["-p", "--permission-mode", "plan", "--system-prompt-file", promptPath];
}

export const claudeAdapter = {
  engine: "claude",
  async invoke(ctx, deps = {}) {
    const run = deps.runProcess ?? defaultRun;
    const { exitCode, stdout, stderr } = await run("claude", buildArgs(ctx.promptPath), { input: ctx.input });
    if (exitCode !== 0) throw new Error("claude judge exit " + exitCode + ": " + stderr);
    return JSON.parse(extractJson(stdout));
  },
};
