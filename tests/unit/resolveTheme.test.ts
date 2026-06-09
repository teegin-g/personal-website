import { describe, expect, it } from "vitest";
import {
  resolveInitialTheme,
  THEME_KEY,
  type Theme,
} from "@/lib/theme/resolveTheme";

describe("resolveInitialTheme", () => {
  it("uses stored theme when valid", () => {
    expect(resolveInitialTheme("ledger", true)).toBe("ledger");
    expect(resolveInitialTheme("phosphor", false)).toBe("phosphor");
  });
  it("falls back to prefers-color-scheme when unset", () => {
    expect(resolveInitialTheme(null, true)).toBe("phosphor"); // prefers dark
    expect(resolveInitialTheme(null, false)).toBe("ledger");
  });
  it("ignores invalid stored values", () => {
    expect(resolveInitialTheme("banana" as Theme, false)).toBe("ledger");
  });
  it("exposes a stable storage key", () => {
    expect(THEME_KEY).toBe("tg-theme");
  });
});
