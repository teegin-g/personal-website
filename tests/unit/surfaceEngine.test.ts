import { describe, expect, it } from "vitest";
import {
  DOMAIN,
  equilibriumHeight,
  heightAt,
  displacement,
  settledness,
  meanDisplacement,
  seedAgents,
  agentHeight,
  type Shock,
  type Well,
} from "@/lib/hero/surfaceEngine";

const NO_WELLS: Well[] = [];
const NO_SHOCKS: Shock[] = [];

describe("surfaceEngine", () => {
  it("(a) converges: mean displacement at progress=0.5 << at progress=0", () => {
    const chaotic = meanDisplacement(0, 0);
    const settled = meanDisplacement(0, 0.5);
    expect(settled).toBeLessThan(chaotic * 0.05);
    // By mid-scroll the chaos term is fully gone: surface == equilibrium.
    expect(settled).toBeCloseTo(0, 6);
    // Sampled across time it stays settled (chaos amplitude is 0, not phase).
    expect(meanDisplacement(3.3, 0.5)).toBeCloseTo(0, 6);
  });

  it("(b) saddle: local MIN along stable x axis, local MAX along unstable z axis", () => {
    const eps = 0.05;
    const center = equilibriumHeight(0, 0);
    // Stable x-valley: moving along +/-x raises height (local minimum).
    expect(equilibriumHeight(eps, 0)).toBeGreaterThan(center);
    expect(equilibriumHeight(-eps, 0)).toBeGreaterThan(center);
    // Unstable z-ridge: moving along +/-z lowers height (local maximum).
    expect(equilibriumHeight(0, eps)).toBeLessThan(center);
    expect(equilibriumHeight(0, -eps)).toBeLessThan(center);
    // Discrete second-derivative signs confirm the saddle near origin.
    const d2x =
      equilibriumHeight(eps, 0) - 2 * center + equilibriumHeight(-eps, 0);
    const d2z =
      equilibriumHeight(0, eps) - 2 * center + equilibriumHeight(0, -eps);
    expect(d2x).toBeGreaterThan(0); // curves up in x
    expect(d2z).toBeLessThan(0); // curves down in z
  });

  it("(c) shock then re-settle: displacement spikes then decays toward settled", () => {
    const progress = 0.5; // chaos already gone, so we isolate the shock
    const shock: Shock = { x: 0, z: 0, t0: 0, strength: 1 };
    // Probe a point out along the UNSTABLE z axis (where the shock is aimed).
    const px = 0;
    const pz = SHOCK_PROBE_Z;
    const baseline = displacement(px, pz, 0, progress, NO_WELLS, NO_SHOCKS);
    expect(baseline).toBeCloseTo(0, 6);

    // Find the displacement near the ring front as it passes the probe, and
    // confirm it is meaningfully above baseline at some early time.
    let peak = 0;
    for (let t = 0.0; t <= 1.0; t += 0.02) {
      const d = displacement(px, pz, t, progress, NO_WELLS, [shock]);
      if (d > peak) peak = d;
    }
    expect(peak).toBeGreaterThan(0.05);

    // Long after injection the temporal decay drives displacement back to ~0.
    const late = displacement(px, pz, 8, progress, NO_WELLS, [shock]);
    expect(late).toBeLessThan(1e-3);
    expect(late).toBeLessThan(peak * 0.05);

    // Whole-grid mean displacement under the shock also decays to settled.
    const earlyMean = meanDisplacement(0.25, progress, 16, NO_WELLS, [shock]);
    const lateMean = meanDisplacement(8, progress, 16, NO_WELLS, [shock]);
    expect(lateMean).toBeLessThan(earlyMean);
    expect(lateMean).toBeCloseTo(0, 4);
  });

  it("(c2) shock is biased along the unstable z axis", () => {
    const progress = 0.5;
    const shock: Shock = { x: 0, z: 0, t0: 0, strength: 1 };
    // Compare same-radius probes: one along z (unstable), one along x (stable).
    const r = SHOCK_PROBE_Z;
    let peakZ = 0;
    let peakX = 0;
    for (let t = 0; t <= 1.0; t += 0.02) {
      const dz = displacement(0, r, t, progress, NO_WELLS, [shock]);
      const dx = displacement(r, 0, t, progress, NO_WELLS, [shock]);
      if (dz > peakZ) peakZ = dz;
      if (dx > peakX) peakX = dx;
    }
    expect(peakZ).toBeGreaterThan(peakX);
  });

  it("(d) deterministic: same seed gives identical agent layout", () => {
    const a = seedAgents(120, 42);
    const b = seedAgents(120, 42);
    expect(a).toHaveLength(120);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].x).toBe(b[i].x);
      expect(a[i].z).toBe(b[i].z);
      expect(a[i].seedPhase).toBe(b[i].seedPhase);
    }
    // Different seed differs.
    const c = seedAgents(120, 43);
    expect(c[0].x).not.toBe(a[0].x);
    // Agents lie within the domain.
    for (const ag of a) {
      expect(Math.abs(ag.x)).toBeLessThanOrEqual(DOMAIN);
      expect(Math.abs(ag.z)).toBeLessThanOrEqual(DOMAIN);
    }
    // Agent height samples heightAt at the agent position.
    const ag = a[0];
    expect(agentHeight(ag, 0, 0.5, NO_WELLS, NO_SHOCKS)).toBeCloseTo(
      heightAt(ag.x, ag.z, 0, 0.5, NO_WELLS, NO_SHOCKS),
      9,
    );
  });

  it("(e) settledness is in [0,1] and ~1 on the settled surface", () => {
    // On the settled surface (progress=0.5, no interactions) every sample is at
    // its equilibrium height => settledness ~ 1.
    for (let i = 0; i < 50; i++) {
      const x = (i / 49) * 2 - 1;
      const z = Math.sin(i) * DOMAIN;
      const s = settledness(x, z, 1.7, 0.5, NO_WELLS, NO_SHOCKS);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
      expect(s).toBeCloseTo(1, 6);
    }
    // In full chaos (progress=0) the mean settledness is clearly below 1.
    let sum = 0;
    let n = 0;
    for (let i = 0; i < 20; i++) {
      for (let j = 0; j < 20; j++) {
        const x = (i / 19) * 2 - 1;
        const z = (j / 19) * 2 - 1;
        sum += settledness(x, z, 0.0, 0, NO_WELLS, NO_SHOCKS);
        n++;
      }
    }
    expect(sum / n).toBeLessThan(0.85);
  });

  it("cursor well lifts the surface locally", () => {
    const well: Well = { x: 0.2, z: -0.1, strength: 1 };
    const atCenter = heightAt(0.2, -0.1, 0, 0.5, [well], NO_SHOCKS);
    const eqCenter = equilibriumHeight(0.2, -0.1);
    expect(atCenter).toBeGreaterThan(eqCenter); // lifted (tented)
    // Far from the well, negligible effect.
    const far = displacement(-0.9, 0.9, 0, 0.5, [well], NO_SHOCKS);
    expect(far).toBeLessThan(1e-3);
  });
});

// Probe distance out along the unstable z axis used by the shock tests. Chosen
// so the expanding ring front (front = age * SHOCK_SPEED) sweeps across it
// within the sampled time window.
const SHOCK_PROBE_Z = 0.4;
