import { describe, expect, it } from "vitest";

import {
  deltaTone,
  formatCompact,
  formatMoney,
  formatPct,
} from "@/lib/sim/format";

describe("formatPct", () => {
  it("formats a percentage with default 1 decimal place", () => {
    expect(formatPct(0.1234)).toBe("12.3%");
  });

  it("formats a percentage with 0 decimal places", () => {
    expect(formatPct(0.5, 0)).toBe("50%");
  });

  it("returns '--' for NaN", () => {
    expect(formatPct(NaN)).toBe("--");
  });

  it("returns '--' for Infinity", () => {
    expect(formatPct(Infinity)).toBe("--");
  });
});

describe("formatMoney", () => {
  it("formats with 2 decimal places by default", () => {
    expect(formatMoney(13)).toBe("$13.00");
  });

  it("formats with 0 decimal places", () => {
    expect(formatMoney(1350, 0)).toBe("$1350");
  });

  it("returns '--' for NaN", () => {
    expect(formatMoney(NaN)).toBe("--");
  });
});

describe("formatCompact", () => {
  it("formats 1500 as 1.5k", () => {
    expect(formatCompact(1500)).toBe("1.5k");
  });

  it("replaces G with B for billions", () => {
    const result = formatCompact(2_000_000_000);
    expect(result).toMatch(/B/);
    expect(result).not.toMatch(/G/);
  });

  it("returns '--' for NaN", () => {
    expect(formatCompact(NaN)).toBe("--");
  });

  it("returns '--' for Infinity", () => {
    expect(formatCompact(Infinity)).toBe("--");
  });
});

describe("deltaTone", () => {
  it("returns 'positive' for zero", () => {
    expect(deltaTone(0)).toBe("positive");
  });

  it("returns 'positive' for positive value", () => {
    expect(deltaTone(5)).toBe("positive");
  });

  it("returns 'danger' for negative value", () => {
    expect(deltaTone(-0.01)).toBe("danger");
  });
});
