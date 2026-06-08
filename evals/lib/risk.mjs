// harness/evals/lib/risk.mjs
import { globToRegExp } from "./glob.mjs";

/**
 * @param {string[]} changedFiles
 * @param {{ triggers?: string[] } | undefined} checklistRisk
 * @param {{ max_changed_files: number, risky_globs: string[] }} riskConfig
 * @returns {{ level: "risky" | "trivial", triggers: string[] }}
 */
export function classifyRisk(changedFiles, checklistRisk, riskConfig) {
  const triggers = new Set(checklistRisk?.triggers ?? []);

  for (const glob of riskConfig.risky_globs) {
    const re = globToRegExp(glob);
    if (changedFiles.some((f) => re.test(f))) triggers.add("path:" + glob);
  }

  if (changedFiles.length > riskConfig.max_changed_files) {
    triggers.add("changed-files>" + riskConfig.max_changed_files);
  }

  const list = [...triggers];
  return { level: list.length > 0 ? "risky" : "trivial", triggers: list };
}
