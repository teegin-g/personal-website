export type Theme = "phosphor" | "ledger";

export const THEME_KEY = "tg-theme";

export function isTheme(v: unknown): v is Theme {
  return v === "phosphor" || v === "ledger";
}

export function resolveInitialTheme(
  stored: string | null,
  prefersDark: boolean,
): Theme {
  if (isTheme(stored)) return stored;
  return prefersDark ? "phosphor" : "ledger";
}
