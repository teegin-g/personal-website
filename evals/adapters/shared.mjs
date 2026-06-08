// harness/evals/adapters/shared.mjs

/**
 * Pull the first top-level JSON object out of engine stdout.
 * @param {string} text
 * @returns {string}
 */
export function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object found in judge output");
  return text.slice(start, end + 1);
}
