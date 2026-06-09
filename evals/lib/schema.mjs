// harness/evals/lib/schema.mjs

/** @typedef {{ schema: string, version: number }} SchemaTag */

export const SCHEMAS = {
  checks: { schema: "project-setup/eval-checks", version: 1 },
  judgeConfig: { schema: "project-setup/eval-judge-config", version: 1 },
  checklist: { schema: "project-setup/eval-checklist", version: 1 },
  deterministic: { schema: "project-setup/eval-deterministic", version: 1 },
  verdict: { schema: "project-setup/eval-verdict", version: 1 },
};

/**
 * @param {any} obj
 * @param {SchemaTag} tag
 * @returns {boolean}
 */
export function isSchema(obj, tag) {
  return !!obj && obj.schema === tag.schema && obj.version === tag.version;
}

/**
 * @param {any} obj
 * @param {SchemaTag} tag
 * @param {string} label
 */
export function assertSchema(obj, tag, label) {
  if (!isSchema(obj, tag)) {
    const got = obj ? obj.schema + "@" + obj.version : String(obj);
    throw new Error(label + ": expected " + tag.schema + "@" + tag.version + ", got " + got);
  }
}
