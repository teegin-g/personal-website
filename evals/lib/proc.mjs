// harness/evals/lib/proc.mjs
import { spawn } from "node:child_process";

/**
 * Spawn a process, capture stdout/stderr, optionally pass a payload on stdin.
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ input?: string, cwd?: string }} [opts]
 * @returns {Promise<{ exitCode: number, stdout: string, stderr: string }>}
 */
export function runProcess(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => resolve({ exitCode: code ?? 0, stdout, stderr }));
    if (opts.input !== undefined) child.stdin.write(opts.input);
    child.stdin.end();
  });
}
