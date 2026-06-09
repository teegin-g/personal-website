// Pure, framework-agnostic height field for the "Settling Surface" hero.
// SINGLE SOURCE OF TRUTH. No DOM, no three, no React.
//
// The renderer's vertex shader MUST mirror heightAt() bit-for-bit. Every
// constant, term, and easing below is chosen to be trivially portable to GLSL
// (no closures, no arrays-of-structs beyond fixed-size loops, plain float ops).
//
// COORDINATE SPACE
//   The surface lives on the XZ plane in a centered domain
//   [-DOMAIN, DOMAIN] x [-DOMAIN, DOMAIN] (world units). heightAt returns Y.
//   The STABLE valley axis is X (the market re-settles into the X-valley).
//   The UNSTABLE ridge axis is Z (the knife-edge a price shock runs along).
//
// THE SCALAR (graft 1): settledness = a pure function of how far a sample sits
//   from its equilibrium height. chaos high -> dim; valley/settled -> bloom.
//
// THE GEOMETRY (graft 2): the equilibrium base is a SADDLE
//   y = SADDLE_X * x^2  -  SADDLE_Z * z^2   (min along x, max along z)
//   plus two gentle secondary gaussian basins so the valley is not a bare bowl.

// ----------------------------------------------------------------------------
// Domain + saddle constants (GLSL-portable; renderer reads these).
// ----------------------------------------------------------------------------
export const DOMAIN = 1.0; // surface spans [-1, 1] in x and z (world units)

// Saddle coefficients. Stable (curving up) in x, unstable (curving down) in z.
export const SADDLE_X = 0.45; // y curves UP along x  -> local MIN axis (stable)
export const SADDLE_Z = 0.45; // y curves DOWN along z -> local MAX axis (unstable)

// Secondary basins: two gentle gaussian dimples that decorate the valley floor
// so the settled surface is not a single perfect parabola. Small amplitude so
// they never flip the saddle's second-derivative signs near the origin.
export const BASIN_AMP = 0.06; // depth of each secondary basin
export const BASIN_SIGMA = 0.35; // gaussian width of each basin
// Basin centers, kept ON the stable x-valley line (z=0) and away from origin so
// the origin's saddle curvature is preserved.
export const BASIN_CENTERS: readonly [number, number][] = [
  [-0.55, 0.0],
  [0.55, 0.0],
];

// ----------------------------------------------------------------------------
// Chaos constants. The pre-settlement turbulence. Its amplitude smoothsteps to
// ~0 as progress goes 0 -> 0.5 (CHAOS_END), so by mid-scroll the surface is the
// pure equilibrium saddle. Two summed sines (no noise texture) => easy in GLSL.
// ----------------------------------------------------------------------------
export const CHAOS_AMP = 0.5; // peak chaos height at progress 0
export const CHAOS_END = 0.5; // progress at which chaos amplitude reaches 0
export const CHAOS_FREQ_A = 3.1; // spatial frequency, wave A
export const CHAOS_FREQ_B = 2.3; // spatial frequency, wave B
export const CHAOS_SPEED_A = 0.7; // temporal speed, wave A
export const CHAOS_SPEED_B = 0.9; // temporal speed, wave B

// ----------------------------------------------------------------------------
// Cursor well constants. A gaussian "tent" that lifts the terrain locally (the
// 3D analog of the old r=140 cursor repulsion). Positive height = lift.
// ----------------------------------------------------------------------------
export const WELL_AMP = 0.35; // peak lift at the well center
export const WELL_RADIUS = 0.32; // gaussian sigma of the well

// ----------------------------------------------------------------------------
// Shock constants. A pointer-down injects a radially-expanding damped-sine ring
// AIMED ALONG THE UNSTABLE AXIS (z): the displacement is scaled by how aligned
// the sample is with the z (ridge) axis, so the run-away is a correct phase
// portrait of instability. The ring expands at SHOCK_SPEED and decays in time.
// ----------------------------------------------------------------------------
export const SHOCK_AMP = 0.45; // initial shock height
export const SHOCK_SPEED = 0.9; // radial expansion speed (world units / time)
export const SHOCK_WAVELENGTH = 0.45; // damped-sine spatial wavelength
export const SHOCK_TIME_DECAY = 1.6; // temporal decay rate (1/time): re-settle
export const SHOCK_SPACE_DECAY = 2.2; // spatial decay away from the ring front
export const SHOCK_AXIS_BIAS = 0.6; // 0..1 how strongly the shock favors z axis

// Settledness normalization: displacement at/above this reads as fully chaotic
// (settledness 0). At zero displacement settledness is 1.
export const SETTLE_NORM = CHAOS_AMP; // a sample this far off equilibrium => 0

// ----------------------------------------------------------------------------
// Interaction types.
// ----------------------------------------------------------------------------
export interface Well {
  x: number; // world-space center, x
  z: number; // world-space center, z
  strength: number; // 0..1 multiplier (e.g. fades with pointer leave)
}

export interface Shock {
  x: number; // world-space origin, x
  z: number; // world-space origin, z
  t0: number; // time the shock was injected
  strength: number; // 0..1 multiplier
}

export interface Agent {
  x: number; // world-space x on the surface
  z: number; // world-space z on the surface
  seedPhase: number; // per-agent deterministic phase (organic offset / links)
}

// ----------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) - identical convention to fieldEngine so the
// CPU reduced-motion frame and any SSR/CSR seeding agree.
// ----------------------------------------------------------------------------
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// smoothstep - identical to GLSL smoothstep(edge0, edge1, x).
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ----------------------------------------------------------------------------
// EQUILIBRIUM (settled) base surface: saddle + secondary basins. No time, no
// chaos, no interaction. This is the target the field re-settles into.
// ----------------------------------------------------------------------------
export function equilibriumHeight(x: number, z: number): number {
  // Saddle: up in x (stable valley axis), down in z (unstable ridge axis).
  let y = SADDLE_X * x * x - SADDLE_Z * z * z;
  // Gentle secondary basins (subtract: they dip the valley floor).
  for (let i = 0; i < BASIN_CENTERS.length; i++) {
    const cx = BASIN_CENTERS[i][0];
    const cz = BASIN_CENTERS[i][1];
    const dx = x - cx;
    const dz = z - cz;
    const r2 = dx * dx + dz * dz;
    y -= BASIN_AMP * Math.exp(-r2 / (2 * BASIN_SIGMA * BASIN_SIGMA));
  }
  return y;
}

// Chaos amplitude as a function of progress: full at 0, zero by CHAOS_END.
export function chaosAmplitude(progress: number): number {
  return CHAOS_AMP * (1 - smoothstep(0, CHAOS_END, progress));
}

// Turbulent pre-settlement term. Two summed sines, amplitude gated by progress.
export function chaosHeight(x: number, z: number, t: number, progress: number): number {
  const amp = chaosAmplitude(progress);
  if (amp === 0) return 0;
  const a = Math.sin(x * CHAOS_FREQ_A + t * CHAOS_SPEED_A) *
    Math.cos(z * CHAOS_FREQ_A - t * CHAOS_SPEED_A);
  const b = Math.sin((x + z) * CHAOS_FREQ_B + t * CHAOS_SPEED_B);
  return amp * 0.5 * (a + b);
}

// Single cursor well (gaussian lift). Sum over wells in heightAt.
export function wellHeight(x: number, z: number, well: Well): number {
  const dx = x - well.x;
  const dz = z - well.z;
  const r2 = dx * dx + dz * dz;
  return well.strength * WELL_AMP * Math.exp(-r2 / (2 * WELL_RADIUS * WELL_RADIUS));
}

// Single shock: radially-expanding damped sine, biased along the unstable z axis.
export function shockHeight(x: number, z: number, t: number, shock: Shock): number {
  const age = t - shock.t0;
  if (age < 0) return 0;
  const dx = x - shock.x;
  const dz = z - shock.z;
  const r = Math.sqrt(dx * dx + dz * dz);
  // Ring front position; distance of this sample behind/ahead of the front.
  const front = age * SHOCK_SPEED;
  const d = r - front;
  // Temporal decay (re-settle) and spatial decay away from the ring.
  const timeEnv = Math.exp(-SHOCK_TIME_DECAY * age);
  const spaceEnv = Math.exp(-SHOCK_SPACE_DECAY * Math.abs(d));
  // Axis bias: favor the unstable z axis. dirZ in [0,1]; 1 when purely along z.
  const dirZ = r > 1e-6 ? Math.abs(dz) / r : 1;
  const axis = 1 - SHOCK_AXIS_BIAS + SHOCK_AXIS_BIAS * dirZ;
  const wave = Math.sin((2 * Math.PI * d) / SHOCK_WAVELENGTH);
  return shock.strength * SHOCK_AMP * timeEnv * spaceEnv * axis * wave;
}

// ----------------------------------------------------------------------------
// heightAt - THE function the vertex shader mirrors. Full surface height at a
// world (x, z) and time t, given scroll progress and active wells/shocks.
//   y = equilibrium + chaos(progress) + sum(wells) + sum(shocks)
// ----------------------------------------------------------------------------
export function heightAt(
  x: number,
  z: number,
  t: number,
  progress: number,
  wells: readonly Well[],
  shocks: readonly Shock[],
): number {
  let y = equilibriumHeight(x, z);
  y += chaosHeight(x, z, t, progress);
  for (let i = 0; i < wells.length; i++) y += wellHeight(x, z, wells[i]);
  for (let i = 0; i < shocks.length; i++) y += shockHeight(x, z, t, shocks[i]);
  return y;
}

// Displacement of a sample from its equilibrium (settled) height. The driver of
// the color rule and the test convergence metrics. >= 0.
export function displacement(
  x: number,
  z: number,
  t: number,
  progress: number,
  wells: readonly Well[],
  shocks: readonly Shock[],
): number {
  return Math.abs(
    heightAt(x, z, t, progress, wells, shocks) - equilibriumHeight(x, z),
  );
}

// Settledness scalar (graft 1): 1 = fully on the settled surface (bloom toward
// glow), 0 = maximally chaotic (dim raw color). Pure function of displacement.
export function settledness(
  x: number,
  z: number,
  t: number,
  progress: number,
  wells: readonly Well[],
  shocks: readonly Shock[],
): number {
  const disp = displacement(x, z, t, progress, wells, shocks);
  const s = 1 - smoothstep(0, SETTLE_NORM, disp);
  return Math.max(0, Math.min(1, s));
}

// ----------------------------------------------------------------------------
// Agent seeding (deterministic). Agents are scattered across the domain; each
// samples heightAt for its y. Same seed => identical layout (SSR/CSR + tests).
// They are placed with a slight bias toward the stable x-valley so that, as the
// surface settles, they collect in the valleys (graft 1 visual).
// ----------------------------------------------------------------------------
export function seedAgents(count: number, seed: number): Agent[] {
  const rng = mulberry32(seed);
  const agents: Agent[] = [];
  for (let i = 0; i < count; i++) {
    const x = (rng() * 2 - 1) * DOMAIN;
    const z = (rng() * 2 - 1) * DOMAIN;
    const seedPhase = rng() * Math.PI * 2;
    agents.push({ x, z, seedPhase });
  }
  return agents;
}

// Agent height sample (convenience for renderer + reduced-motion frame).
export function agentHeight(
  a: Agent,
  t: number,
  progress: number,
  wells: readonly Well[],
  shocks: readonly Shock[],
): number {
  return heightAt(a.x, a.z, t, progress, wells, shocks);
}

// ----------------------------------------------------------------------------
// Roughness / mean-displacement metric over a uniform grid sample. Used by
// tests (and could drive an aggregate "settledness" HUD readout). Lower = more
// settled. Excludes interaction terms by default (pass them if you want them).
// ----------------------------------------------------------------------------
export function meanDisplacement(
  t: number,
  progress: number,
  resolution = 16,
  wells: readonly Well[] = [],
  shocks: readonly Shock[] = [],
): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const x = ((i / (resolution - 1)) * 2 - 1) * DOMAIN;
      const z = ((j / (resolution - 1)) * 2 - 1) * DOMAIN;
      sum += displacement(x, z, t, progress, wells, shocks);
      n++;
    }
  }
  return sum / n;
}
