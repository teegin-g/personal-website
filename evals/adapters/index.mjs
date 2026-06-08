// harness/evals/adapters/index.mjs
import { claudeAdapter } from "./claude.mjs";
import { codexAdapter } from "./codex.mjs";
import { cursorAdapter } from "./cursor.mjs";

const REGISTRY = {
  claude: claudeAdapter,
  codex: codexAdapter,
  cursor: cursorAdapter,
};

/**
 * @param {string | undefined} engine
 * @param {Record<string, any>} [registry]
 * @returns {any | null}
 */
export function selectAdapter(engine, registry = REGISTRY) {
  if (!engine) return null;
  return registry[engine] ?? null;
}
