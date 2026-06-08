// harness/evals/lib/bundle.mjs
import fs from "node:fs";
import path from "node:path";

/**
 * Write the evidence bundle and a single concatenated text payload for stdin.
 * Each deterministic gate with non-empty output also gets a commands/<name>.log.
 * @param {string} runDir
 * @param {{
 *   request: string,
 *   checklist: any,
 *   diff: string,
 *   changedFiles: string[],
 *   deterministic: any,
 * }} inputs
 * @returns {{ bundleDir: string, bundleTxtPath: string }}
 */
export function assembleBundle(runDir, inputs) {
  const bundleDir = path.join(runDir, "bundle");
  fs.mkdirSync(bundleDir, { recursive: true });
  for (const sub of ["screenshots", "traces", "data", "commands"]) {
    fs.mkdirSync(path.join(bundleDir, sub), { recursive: true });
  }

  const write = (name, contents) => fs.writeFileSync(path.join(bundleDir, name), contents, "utf8");
  write("request.md", inputs.request);
  write("checklist.json", JSON.stringify(inputs.checklist, null, 2));
  write("diff.patch", inputs.diff);
  write("changed-files.txt", inputs.changedFiles.join("\n") + "\n");
  write("deterministic.json", JSON.stringify(inputs.deterministic, null, 2));

  const gates = (inputs.deterministic && inputs.deterministic.gates) || [];
  for (const g of gates) {
    if (typeof g.output === "string" && g.output.length > 0) {
      fs.writeFileSync(path.join(bundleDir, "commands", g.name + ".log"), g.output, "utf8");
    }
  }

  const bundleTxt = [
    "# REQUEST", inputs.request,
    "# CHECKLIST", JSON.stringify(inputs.checklist, null, 2),
    "# CHANGED FILES", inputs.changedFiles.join("\n"),
    "# DIFF", inputs.diff,
    "# DETERMINISTIC RESULTS", JSON.stringify(inputs.deterministic, null, 2),
  ].join("\n\n");
  const bundleTxtPath = path.join(bundleDir, "bundle.txt");
  fs.writeFileSync(bundleTxtPath, bundleTxt, "utf8");

  return { bundleDir, bundleTxtPath };
}
