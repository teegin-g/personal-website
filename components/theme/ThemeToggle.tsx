"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === "phosphor" ? "ledger" : "phosphor";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      className="fixed right-5 top-5 z-50 rounded-full border border-accent/40 bg-surface/60 px-4 py-2 font-mono text-xs tracking-wide text-ink backdrop-blur transition-colors hover:border-accent"
    >
      {theme === "phosphor" ? "night" : "day"}
    </button>
  );
}
