import { describe, expect, it } from "vitest";
import {
  createField,
  stepField,
  computeLinks,
  applyShock,
  meanDistanceToEquilibrium,
} from "@/lib/hero/fieldEngine";

const cfg = { count: 60, width: 1000, height: 800, seed: 7 };

describe("fieldEngine", () => {
  it("creates a stable agent count", () => {
    const f = createField(cfg);
    expect(f.agents).toHaveLength(60);
    for (let i = 0; i < 50; i++)
      stepField(f, { dt: 1, progress: 0.5, pointer: null });
    expect(f.agents).toHaveLength(60);
  });

  it("converges toward equilibrium at progress=0.5", () => {
    const f = createField(cfg);
    const before = meanDistanceToEquilibrium(f);
    for (let i = 0; i < 200; i++)
      stepField(f, { dt: 1, progress: 0.5, pointer: null });
    const after = meanDistanceToEquilibrium(f);
    expect(after).toBeLessThan(before);
    expect(after).toBeLessThan(f.height * 0.08);
  });

  it("re-converges after a shock", () => {
    const f = createField(cfg);
    for (let i = 0; i < 200; i++)
      stepField(f, { dt: 1, progress: 0.5, pointer: null });
    const settled = meanDistanceToEquilibrium(f);
    applyShock(f, { x: 500, y: 400, strength: 300 });
    expect(meanDistanceToEquilibrium(f)).toBeGreaterThan(settled);
    for (let i = 0; i < 200; i++)
      stepField(f, { dt: 1, progress: 0.5, pointer: null });
    expect(meanDistanceToEquilibrium(f)).toBeLessThan(f.height * 0.1);
  });

  it("forms network links by distance threshold at high progress", () => {
    const f = createField(cfg);
    for (let i = 0; i < 200; i++)
      stepField(f, { dt: 1, progress: 1, pointer: null });
    const links = computeLinks(f, 90);
    expect(links.length).toBeGreaterThan(0);
    for (const [a, b] of links) {
      const dx = f.agents[a].x - f.agents[b].x;
      const dy = f.agents[a].y - f.agents[b].y;
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(90);
    }
  });

  it("is deterministic for a given seed", () => {
    const f1 = createField(cfg);
    const f2 = createField(cfg);
    for (let i = 0; i < 20; i++) {
      stepField(f1, { dt: 1, progress: 0.3, pointer: null });
      stepField(f2, { dt: 1, progress: 0.3, pointer: null });
    }
    expect(f1.agents[0].x).toBeCloseTo(f2.agents[0].x, 5);
  });
});
