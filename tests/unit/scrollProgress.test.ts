import { describe, expect, it } from "vitest";
import { scrollToProgress, progressToBeat } from "@/lib/hero/scrollProgress";

describe("scrollToProgress", () => {
  it("is 0 at top and 1 at bottom of scrollable range", () => {
    expect(scrollToProgress(0, 3000, 1000)).toBe(0);
    expect(scrollToProgress(2000, 3000, 1000)).toBe(1);
  });
  it("is 0.5 at the midpoint", () => {
    expect(scrollToProgress(1000, 3000, 1000)).toBeCloseTo(0.5, 5);
  });
  it("clamps out-of-range input", () => {
    expect(scrollToProgress(-50, 3000, 1000)).toBe(0);
    expect(scrollToProgress(99999, 3000, 1000)).toBe(1);
  });
  it("returns 0 when content fits the viewport (no scroll range)", () => {
    expect(scrollToProgress(0, 800, 1000)).toBe(0);
  });
});

describe("progressToBeat", () => {
  it("maps thirds to beats 0,1,2", () => {
    expect(progressToBeat(0.1)).toBe(0);
    expect(progressToBeat(0.5)).toBe(1);
    expect(progressToBeat(0.9)).toBe(2);
  });
});
