// harness/evals/adapters/cursor.mjs
import { runProcess as defaultRun } from "../lib/proc.mjs";
import { extractJson } from "./shared.mjs";

function buildArgs(promptPath) {
  return ["--headless", "--no-tools", "--prompt-file", promptPath];
}

export const cursorAdapter = {
  engine: "cursor",
  async invoke(ctx, deps = {}) {
    const run = deps.runProcess ?? defaultRun;
    const { exitCode, stdout, stderr } = await run("cursor-agent", buildArgs(ctx.promptPath), { input: ctx.input });
    if (exitCode !== 0) throw new Error("cursor judge exit " + exitCode + ": " + stderr);
    return JSON.parse(extractJson(stdout));
  },
};
