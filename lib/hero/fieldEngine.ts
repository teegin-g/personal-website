// Pure, framework-agnostic agent-based field simulation.
// No DOM, no React: positions are in an abstract width x height space.

export interface Agent {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number; // per-agent offset for organic motion
}

export interface Field {
  agents: Agent[];
  width: number;
  height: number;
  t: number;
}

export interface FieldConfig {
  count: number;
  width: number;
  height: number;
  seed: number;
}

export interface Pointer {
  x: number;
  y: number;
}

export interface StepInput {
  dt: number;
  progress: number; // 0..1 narrative scroll position
  pointer: Pointer | null;
}

// Deterministic PRNG (mulberry32) so tests and SSR/CSR agree.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function equilibriumY(field: Field): number {
  // Breathing line near vertical center.
  return field.height * 0.52 + Math.sin(field.t * 0.5) * (field.height * 0.04);
}

export function createField(cfg: FieldConfig): Field {
  const rng = mulberry32(cfg.seed);
  const agents: Agent[] = [];
  for (let i = 0; i < cfg.count; i++) {
    agents.push({
      x: rng() * cfg.width,
      y: rng() * cfg.height,
      vx: 0,
      vy: 0,
      phase: rng() * Math.PI * 2,
    });
  }
  return { agents, width: cfg.width, height: cfg.height, t: 0 };
}

export function applyShock(
  field: Field,
  shock: { x: number; y: number; strength: number },
): void {
  // A shock is a price disturbance: it knocks agents OFF the equilibrium line
  // (vertical scatter, the axis convergence is measured on) and spreads them
  // horizontally away from the impact point. Falls off with distance.
  const radius = field.width * 0.6;
  const eqY = equilibriumY(field);
  for (const a of field.agents) {
    const dx = a.x - shock.x;
    const dy = a.y - shock.y;
    const d = Math.hypot(dx, dy) || 1;
    const falloff = Math.max(0, 1 - d / radius);
    if (falloff <= 0) continue;
    // Vertical scatter away from equilibrium, deterministic per-agent direction.
    const vDir = Math.sin(a.phase * 7) >= 0 ? 1 : -1;
    const vKick = falloff * shock.strength * 0.35 * vDir;
    a.y += vKick;
    a.vy += vKick * 0.3;
    // Horizontal radial spread.
    const hKick = (dx / d) * falloff * shock.strength * 0.25;
    a.x += hKick;
    a.vx += hKick * 0.3;
    // Keep within bounds.
    if (a.y < 0) a.y = 0;
    if (a.y > field.height) a.y = field.height;
  }
}

export function stepField(field: Field, input: StepInput): Field {
  const { dt, progress, pointer } = input;
  field.t += 0.016 * dt;
  const eqY = equilibriumY(field);
  // progress: 0 chaos -> 0.5 equilibrium pull -> 1 network (still settled)
  const pull = Math.min(1, progress * 2) * 0.0016; // strengthens into equilibrium
  const damping = 0.9;

  for (const a of field.agents) {
    const target =
      eqY + Math.sin(a.x * 0.01 + field.t + a.phase) * (field.height * 0.012);
    // chaos drift when progress is low
    const chaos = (1 - Math.min(1, progress * 2)) * 0.15;
    a.vy += (target - a.y) * pull * dt;
    a.vx += Math.sin(field.t + a.phase) * chaos * dt;
    a.vy += Math.cos(field.t * 1.3 + a.phase) * chaos * dt;

    if (pointer) {
      const dx = a.x - pointer.x;
      const dy = a.y - pointer.y;
      const d = Math.hypot(dx, dy);
      if (d < 140 && d > 0.001) {
        const f = (1 - d / 140) * 1.4;
        a.vx += (dx / d) * f * dt;
        a.vy += (dy / d) * f * dt;
      }
    }

    a.vx *= damping;
    a.vy *= damping;
    a.x += a.vx * dt;
    a.y += a.vy * dt;

    // wrap horizontally, clamp vertically
    if (a.x < 0) a.x += field.width;
    if (a.x > field.width) a.x -= field.width;
    if (a.y < 0) {
      a.y = 0;
      a.vy *= -0.5;
    }
    if (a.y > field.height) {
      a.y = field.height;
      a.vy *= -0.5;
    }
  }
  return field;
}

export function meanDistanceToEquilibrium(field: Field): number {
  const eqY = equilibriumY(field);
  let sum = 0;
  for (const a of field.agents) sum += Math.abs(a.y - eqY);
  return sum / field.agents.length;
}

export function computeLinks(field: Field, threshold: number): [number, number][] {
  const links: [number, number][] = [];
  const a = field.agents;
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      const dx = a[i].x - a[j].x;
      const dy = a[i].y - a[j].y;
      if (Math.hypot(dx, dy) <= threshold) links.push([i, j]);
    }
  }
  return links;
}
