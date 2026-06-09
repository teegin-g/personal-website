"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import {
  DOMAIN,
  SETTLE_NORM,
  WELL_RADIUS,
  heightAt,
  equilibriumHeight,
  seedAgents,
  settledness,
  type Agent,
  type Shock,
  type Well,
} from "@/lib/hero/surfaceEngine";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { Theme } from "@/lib/theme/resolveTheme";

/**
 * EquilibriumSurface - three.js renderer for the "Settling Surface" hero.
 *
 * Replaces EquilibriumField.tsx; accepts the SAME prop ({ progressRef }) so
 * app/page.tsx swaps cleanly. Renders the displaced-mesh terrain whose height
 * is the EXACT engine height field (lib/hero/surfaceEngine.ts). The vertex
 * shader mirrors heightAt() bit-for-bit; agent points sample the same CPU
 * function so dots can never float off the relief.
 *
 * GRAFT 1 (settledness is the only color rule): brightness is a pure function
 * of distance-to-equilibrium. Chaotic high regions read dim raw color; settled
 * valleys bloom toward the glow color. The same scalar drives terrain emissive,
 * agent halos, and the emergent links.
 *
 * GRAFT 2 (the equilibrium IS a saddle): stable valley along X, unstable ridge
 * along Z; pointer-down shocks are aimed along the unstable Z axis.
 */

// ----------------------------------------------------------------------------
// THEME_COLORS - mirrored from app/globals.css OKLCH tokens (per DESIGN.md
// THEME_COLORS convention). Stored as LINEAR-sRGB 0..1 because three r152+
// works in a linear working space (default color management ON); feeding
// already-linear literals keeps colors true, not washed/muddy. The sRGB-255
// equivalents (in comments) match EquilibriumField's THEME_COLORS table.
//
//   token            OKLCH                       sRGB255          linear
//   phosphor.bg      oklch(0.16 0.012 250)       9,14,18
//   phosphor.agent   oklch(0.80 0.11  230)       107,203,247   raw (sky)
//   phosphor.glow    oklch(0.85 0.14  180)       66,235,209    settled bloom (teal)
//   phosphor.ink     oklch(0.97 0.005 250)       243,245,248
//   ledger.bg        oklch(0.95 0.012 95)        241,239,230
//   ledger.accent    oklch(0.46 0.07  200)       25,100,103    raw + link (deep teal)
//   ledger.glow      oklch(0.70 0.14  75)        208,144,30    settled (ochre)
//   ledger.ink       oklch(0.22 0.01  60)        30,26,22
// ----------------------------------------------------------------------------
type Vec3 = readonly [number, number, number];
interface ThemePalette {
  bg: Vec3; // page bg (terrain base tint + clear color)
  raw: Vec3; // dim color far from equilibrium (chaos)
  settled: Vec3; // bloom color in settled valleys
  link: Vec3; // emergent network links
  ink: Vec3; // ridge highlight
  additive: 0 | 1; // 1 = additive blend (phosphor glow), 0 = normal (ledger)
}
const THEME_COLORS: Record<Theme, ThemePalette> = {
  // Phosphor (night): additive glow over near-black reads as oscilloscope bloom.
  phosphor: {
    bg: [0.0029, 0.0043, 0.0062],
    raw: [0.1467, 0.5967, 0.9292], // agent sky
    settled: [0.0537, 0.8326, 0.6387], // glow teal
    link: [0.0661, 0.7404, 0.5726], // accent teal
    ink: [0.8928, 0.9162, 0.9419],
    additive: 1,
  },
  // Ledger (day): additive glow DIES on warm off-white. Use NORMAL blend; raw
  // is deep teal (settled darkens toward it), settled adds an ochre rim. Keeps
  // contrast first-class in daylight, not a dark-mode afterthought.
  ledger: {
    bg: [0.8777, 0.8593, 0.7888],
    raw: [0.0096, 0.1265, 0.1367], // deep teal (the darken-toward target)
    settled: [0.6337, 0.2782, 0.0127], // ochre (thin rim only)
    link: [0.0096, 0.1265, 0.1367], // deep teal links
    ink: [0.0131, 0.0101, 0.008],
    additive: 0,
  },
};

// Geometry / agent tiers by viewport width (mobile-first; tier down small).
const tier = (w: number) =>
  w < 640
    ? { seg: 96, agents: 44 }
    : w < 1024
      ? { seg: 144, agents: 70 }
      : { seg: 200, agents: 104 };

const MAX_WELLS = 1;
const MAX_SHOCKS = 4;
const AGENT_SEED = 7;
const LINK_RADIUS = 0.42; // world-space neighbor threshold for emergent links
const THEME_LERP_TAU = 0.6; // seconds to ~63% on theme toggle

interface Props {
  /** Ref the parent updates each scroll; read inside the rAF loop. */
  progressRef: MutableRefObject<number>;
}

export function EquilibriumSurface({ progressRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Sibling 2D canvas for the graceful fallback. A WebGL-bound canvas can never
  // hand back a 2D context, so the static fallback MUST draw into its own
  // element; we swap visibility between the two.
  const fallbackRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const themeRef = useRef<Theme>(theme);
  themeRef.current = theme;

  useEffect(() => {
    const canvas = canvasRef.current;
    const fallbackCanvas = fallbackRef.current;
    if (!canvas) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Camera framing: look down the saddle from above-and-front. World domain
    // is [-1,1] in x,z; we map x->screenX, z->screenY-ish via an angled view.
    let disposed = false;
    let cleanup: (() => void) | null = null;

    // ------------------------------------------------------------------
    // Graceful static fallback: a 2D-canvas render of the SETTLED state,
    // using the SAME engine height/settledness so it matches the live look.
    // Used when WebGL is unsupported, the context is lost, or three fails to
    // import. Never leaves a blank canvas.
    // ------------------------------------------------------------------
    const drawFallback = () => {
      // Draw into the SIBLING 2D canvas (the GL canvas can't yield a 2D
      // context once bound). Then reveal it and hide the GL canvas so a lost
      // or unavailable context never leaves a frozen/blank hero.
      const target = fallbackCanvas ?? canvas;
      const ctx = target.getContext("2d");
      if (!ctx) return;
      if (target !== canvas) {
        target.style.display = "block";
        canvas.style.display = "none";
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      target.width = Math.floor(w * dpr);
      target.height = Math.floor(h * dpr);
      target.style.width = `${w}px`;
      target.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pal = THEME_COLORS[themeRef.current];
      const rgb = (c: Vec3, a: number) =>
        `rgba(${Math.round(linToSrgb(c[0]) * 255)},${Math.round(
          linToSrgb(c[1]) * 255,
        )},${Math.round(linToSrgb(c[2]) * 255)},${a})`;
      ctx.clearRect(0, 0, w, h);
      // Settled agents projected with the same iso projection as the GL scene.
      const agents = seedAgents(tier(w).agents, AGENT_SEED);
      for (const a of agents) {
        const y = equilibriumHeight(a.x, a.z);
        const p = projectIso(a.x, y, a.z, w, h);
        ctx.fillStyle = rgb(pal.settled, 0.9);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgb(pal.settled, 0.4);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    // WebGL support probe.
    const glSupported = (() => {
      try {
        const c = document.createElement("canvas");
        return !!(
          c.getContext("webgl2") || c.getContext("webgl")
        );
      } catch {
        return false;
      }
    })();

    if (!glSupported) {
      drawFallback();
      const onResize = () => drawFallback();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    // ------------------------------------------------------------------
    // Dynamically import three INSIDE the effect (no first-paint block).
    // Until it resolves we leave the canvas to whatever the prior fallback
    // painted; if it never resolves, we keep the static fallback.
    // ------------------------------------------------------------------
    import("three")
      .then((THREE) => {
        if (disposed || !canvasRef.current) return;
        cleanup = initScene(
          THREE,
          canvas,
          progressRef,
          themeRef,
          reduce,
          drawFallback,
        );
      })
      .catch(() => {
        drawFallback();
      });

    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, [progressRef]);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 h-screen w-screen"
      />
      {/* Static-fallback surface, hidden until WebGL is unavailable or lost. */}
      <canvas
        ref={fallbackRef}
        aria-hidden="true"
        style={{ display: "none" }}
        className="pointer-events-none fixed inset-0 z-0 h-screen w-screen"
      />
    </>
  );
}

// ----------------------------------------------------------------------------
// Shared linear->sRGB (for the 2D fallback only; GL path stays linear).
// ----------------------------------------------------------------------------
function linToSrgb(c: number): number {
  const x = Math.max(0, Math.min(1, c));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
}

// Iso projection shared by GL camera framing and the 2D fallback so the
// settled fallback lines up with the live scene's footprint.
function projectIso(
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
): { x: number; y: number } {
  // Scale domain to a comfortable portion of the viewport, tilt slightly.
  const s = Math.min(w, h) * 0.42;
  const sx = w * 0.5 + x * s;
  const sy = h * 0.56 - y * s * 1.3 + z * s * 0.5;
  return { x: sx, y: sy };
}

// ----------------------------------------------------------------------------
// THREE scene setup. Kept out of the component body so the dynamic import keeps
// `three` types fully local. Returns a cleanup fn.
// ----------------------------------------------------------------------------
function initScene(
  THREE: typeof import("three"),
  canvas: HTMLCanvasElement,
  progressRef: MutableRefObject<number>,
  themeRef: MutableRefObject<Theme>,
  reduce: boolean,
  drawFallback: () => void,
): () => void {
  let renderer: import("three").WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    drawFallback();
    return () => {};
  }
  // three r152+: linear working space, sRGB output. We feed LINEAR color
  // literals to uniforms (THEME_COLORS), so they survive the encode untouched.
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

  // Frame the saddle from above-and-front. Domain is [-1,1]; the surface tilts
  // toward the viewer so the X-valley reads as depth and the Z-ridge as width.
  camera.position.set(0, 1.35, 2.05);
  camera.lookAt(0, -0.08, 0);

  // ----- uniforms (mirror engine constants; documented in shader) -----
  const pal = THEME_COLORS[themeRef.current];
  const uColRaw = new THREE.Color(...pal.raw);
  const uColSettled = new THREE.Color(...pal.settled);
  const uColInk = new THREE.Color(...pal.ink);
  const uColBg = new THREE.Color(...pal.bg);
  // Lerp targets for ~0.6s theme transition.
  const tgtRaw = new THREE.Color(...pal.raw);
  const tgtSettled = new THREE.Color(...pal.settled);
  const tgtInk = new THREE.Color(...pal.ink);
  const tgtBg = new THREE.Color(...pal.bg);

  renderer.setClearColor(uColBg, 1);

  // Well/shock uniform arrays (Vector4 packs: well = x,z,strength,_;
  // shock = x,z,t0,strength). Sized to MAX_*; count uniforms gate the loops.
  const wellArr: import("three").Vector4[] = Array.from(
    { length: MAX_WELLS },
    () => new THREE.Vector4(0, 0, 0, 0),
  );
  const shockArr: import("three").Vector4[] = Array.from(
    { length: MAX_SHOCKS },
    () => new THREE.Vector4(0, 0, -1e9, 0),
  );

  const uniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uColRaw: { value: uColRaw },
    uColSettled: { value: uColSettled },
    uColInk: { value: uColInk },
    uAdditive: { value: pal.additive },
    uWells: { value: wellArr },
    uWellCount: { value: 0 },
    uShocks: { value: shockArr },
    uShockCount: { value: 0 },
  };

  // ----- terrain material (custom GLSL, mirrors surfaceEngine.heightAt) -----
  const terrainMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: pal.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
    vertexShader: VERT,
    fragmentShader: FRAG_TERRAIN,
  });

  const tierNow = tier(window.innerWidth);
  // PlaneGeometry is XY by default; we rotate it onto XZ. Geometry spans
  // [-DOMAIN, DOMAIN] so vertex (x,y)->(x,z) maps straight into engine space.
  let geo = new THREE.PlaneGeometry(
    2 * DOMAIN,
    2 * DOMAIN,
    tierNow.seg,
    tierNow.seg,
  );
  geo.rotateX(-Math.PI / 2); // now plane lies on XZ, normal +Y
  const terrain = new THREE.Mesh(geo, terrainMat);
  scene.add(terrain);

  // Thin wireframe overlay reads the ridge/valley structure (subtle).
  const wireMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: pal.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    wireframe: true,
    vertexShader: VERT,
    fragmentShader: FRAG_WIRE,
  });
  const wire = new THREE.Mesh(geo, wireMat);
  scene.add(wire);

  // ----- agents (Points) + links (LineSegments). CPU-driven positions. -----
  let agents: Agent[] = seedAgents(tierNow.agents, AGENT_SEED);
  let agentPos = new Float32Array(agents.length * 3);
  let agentSettle = new Float32Array(agents.length);

  const agentGeo = new THREE.BufferGeometry();
  agentGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(agentPos, 3),
  );
  agentGeo.setAttribute(
    "aSettle",
    new THREE.BufferAttribute(agentSettle, 1),
  );
  const agentMat = new THREE.ShaderMaterial({
    uniforms: {
      uColRaw: uniforms.uColRaw,
      uColSettled: uniforms.uColSettled,
      uAdditive: uniforms.uAdditive,
      uSize: { value: Math.min(window.devicePixelRatio || 1, 2) * 7 },
    },
    transparent: true,
    depthWrite: false,
    blending: pal.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: VERT_AGENT,
    fragmentShader: FRAG_AGENT,
  });
  const agentPoints = new THREE.Points(agentGeo, agentMat);
  scene.add(agentPoints);

  // Links: capacity = agents^? - we cap to a reasonable max of pairs.
  let linkPositions = new Float32Array(0);
  let linkAlpha = new Float32Array(0);
  let linkGeo = new THREE.BufferGeometry();
  const linkMat = new THREE.ShaderMaterial({
    uniforms: {
      uColLink: { value: new THREE.Color(...pal.link) },
      uAdditive: uniforms.uAdditive,
    },
    transparent: true,
    depthWrite: false,
    blending: pal.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: VERT_LINK,
    fragmentShader: FRAG_LINK,
  });
  const tgtLink = new THREE.Color(...pal.link);
  const links = new THREE.LineSegments(linkGeo, linkMat);
  scene.add(links);

  const allocLinks = (count: number) => {
    linkPositions = new Float32Array(count * 2 * 3);
    linkAlpha = new Float32Array(count * 2);
    linkGeo.dispose();
    linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(linkPositions, 3),
    );
    linkGeo.setAttribute("aAlpha", new THREE.BufferAttribute(linkAlpha, 1));
    links.geometry = linkGeo;
  };
  // Worst-case pair count is O(n^2); cap conservatively for the largest tier.
  allocLinks(tier(1440).agents * 6);

  // ------------------------------------------------------------------
  // Pointer -> world. The terrain occupies a known footprint; we map the
  // pointer to engine (x,z) by intersecting the camera ray with the y=0 plane
  // (a good-enough analog of the old screen-space r=140 well; the well is a
  // soft gaussian so exactness is not required).
  // ------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const planeY0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const well: Well = { x: 0, z: 0, strength: 0 };
  let wellActive = false;
  const shocks: Shock[] = [];

  const pointerToWorld = (clientX: number, clientY: number): boolean => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ndc.x = (clientX / w) * 2 - 1;
    ndc.y = -((clientY / h) * 2 - 1);
    raycaster.setFromCamera(ndc, camera);
    const ok = raycaster.ray.intersectPlane(planeY0, hit);
    return !!ok;
  };

  const onMove = (e: PointerEvent) => {
    if (pointerToWorld(e.clientX, e.clientY)) {
      well.x = THREE.MathUtils.clamp(hit.x, -DOMAIN, DOMAIN);
      well.z = THREE.MathUtils.clamp(hit.z, -DOMAIN, DOMAIN);
      wellActive = true;
    }
  };
  const onLeave = () => {
    wellActive = false;
  };
  const onDown = (e: PointerEvent) => {
    if (!pointerToWorld(e.clientX, e.clientY)) return;
    shocks.push({
      x: THREE.MathUtils.clamp(hit.x, -DOMAIN, DOMAIN),
      // Bias shock origin toward the unstable z axis so the run-away reads.
      z: THREE.MathUtils.clamp(hit.z, -DOMAIN, DOMAIN),
      t0: uniforms.uTime.value,
      strength: 1,
    });
    if (shocks.length > MAX_SHOCKS) shocks.shift();
  };

  // ----- resize -----
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    agentMat.uniforms.uSize.value = dpr * 7;

    // Re-tier geometry + agents on width change.
    const t = tier(w);
    if (t.seg !== geo.parameters.widthSegments) {
      const ng = new THREE.PlaneGeometry(
        2 * DOMAIN,
        2 * DOMAIN,
        t.seg,
        t.seg,
      );
      ng.rotateX(-Math.PI / 2);
      geo.dispose();
      geo = ng;
      terrain.geometry = geo;
      wire.geometry = geo;
    }
    if (t.agents !== agents.length) {
      agents = seedAgents(t.agents, AGENT_SEED);
      agentPos = new Float32Array(agents.length * 3);
      agentSettle = new Float32Array(agents.length);
      agentGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(agentPos, 3),
      );
      agentGeo.setAttribute(
        "aSettle",
        new THREE.BufferAttribute(agentSettle, 1),
      );
    }
  };
  resize();

  // ------------------------------------------------------------------
  // Per-frame uniform + buffer sync (no React render). Wells/shocks packed,
  // agents sampled with the SAME engine functions the shader mirrors.
  // ------------------------------------------------------------------
  const syncInteractions = (tSec: number) => {
    // Fade the well strength toward 0 when pointer left; up to 1 when active.
    const target = wellActive ? 1 : 0;
    well.strength += (target - well.strength) * 0.12;
    if (well.strength > 0.01) {
      wellArr[0].set(well.x, well.z, well.strength, 0);
      uniforms.uWellCount.value = 1;
    } else {
      uniforms.uWellCount.value = 0;
    }
    // Drop fully decayed shocks (timeEnv ~ e^-1.6*age; >4s is negligible).
    for (let i = shocks.length - 1; i >= 0; i--) {
      if (tSec - shocks[i].t0 > 5) shocks.splice(i, 1);
    }
    for (let i = 0; i < MAX_SHOCKS; i++) {
      const s = shocks[i];
      if (s) shockArr[i].set(s.x, s.z, s.t0, s.strength);
      else shockArr[i].set(0, 0, -1e9, 0);
    }
    uniforms.uShockCount.value = Math.min(shocks.length, MAX_SHOCKS);
  };

  // Active wells/shocks views for the engine calls (CPU agent sampling).
  const liveWells = (): Well[] =>
    uniforms.uWellCount.value > 0 ? [well] : [];
  const liveShocks = (): Shock[] => shocks;

  const updateAgents = (tSec: number, progress: number) => {
    const w = liveWells();
    const s = liveShocks();
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      const y = heightAt(a.x, a.z, tSec, progress, w, s);
      agentPos[i * 3] = a.x;
      agentPos[i * 3 + 1] = y;
      agentPos[i * 3 + 2] = a.z;
      agentSettle[i] = settledness(a.x, a.z, tSec, progress, w, s);
    }
    (agentGeo.attributes.position as import("three").BufferAttribute).needsUpdate =
      true;
    (agentGeo.attributes.aSettle as import("three").BufferAttribute).needsUpdate =
      true;
  };

  // Links emerge for progress in [0.66, 1]. Endpoints brighten with settledness
  // (graft 1): a link is only drawn between two SETTLED near-neighbors.
  const updateLinks = (tSec: number, progress: number) => {
    const emerge = progress <= 0.66 ? 0 : (progress - 0.66) / 0.34;
    let n = 0; // segment count
    const cap = linkAlpha.length / 2;
    if (emerge > 0) {
      const r2 = LINK_RADIUS * LINK_RADIUS;
      for (let i = 0; i < agents.length && n < cap; i++) {
        const si = agentSettle[i];
        if (si < 0.45) continue;
        const ax = agentPos[i * 3];
        const ay = agentPos[i * 3 + 1];
        const az = agentPos[i * 3 + 2];
        for (let j = i + 1; j < agents.length && n < cap; j++) {
          const sj = agentSettle[j];
          if (sj < 0.45) continue;
          const dx = ax - agentPos[j * 3];
          const dz = az - agentPos[j * 3 + 2];
          const dist2 = dx * dx + dz * dz;
          if (dist2 > r2) continue;
          const a = Math.min(si, sj) * emerge * (1 - Math.sqrt(dist2) / LINK_RADIUS);
          const k = n * 2;
          linkPositions[k * 3] = ax;
          linkPositions[k * 3 + 1] = ay;
          linkPositions[k * 3 + 2] = az;
          linkAlpha[k] = a;
          linkPositions[(k + 1) * 3] = agentPos[j * 3];
          linkPositions[(k + 1) * 3 + 1] = agentPos[j * 3 + 1];
          linkPositions[(k + 1) * 3 + 2] = agentPos[j * 3 + 2];
          linkAlpha[k + 1] = a;
          n++;
        }
      }
    }
    linkGeo.setDrawRange(0, n * 2);
    (linkGeo.attributes.position as import("three").BufferAttribute).needsUpdate =
      true;
    (linkGeo.attributes.aAlpha as import("three").BufferAttribute).needsUpdate =
      true;
  };

  // ----- theme transition: lerp color uniforms ~0.6s on toggle -----
  let appliedTheme = themeRef.current;
  const retargetTheme = () => {
    const p = THEME_COLORS[themeRef.current];
    tgtRaw.setRGB(p.raw[0], p.raw[1], p.raw[2], THREE.LinearSRGBColorSpace);
    tgtSettled.setRGB(
      p.settled[0],
      p.settled[1],
      p.settled[2],
      THREE.LinearSRGBColorSpace,
    );
    tgtInk.setRGB(p.ink[0], p.ink[1], p.ink[2], THREE.LinearSRGBColorSpace);
    tgtBg.setRGB(p.bg[0], p.bg[1], p.bg[2], THREE.LinearSRGBColorSpace);
    tgtLink.setRGB(p.link[0], p.link[1], p.link[2], THREE.LinearSRGBColorSpace);
    // additive flag and blend modes switch immediately (no half-blend state).
    uniforms.uAdditive.value = p.additive;
    const blend = p.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    terrainMat.blending = blend;
    wireMat.blending = blend;
    agentMat.blending = blend;
    linkMat.blending = blend;
    appliedTheme = themeRef.current;
  };
  retargetTheme();
  // Snap to target on first frame (no fade-in from black on mount).
  uColRaw.copy(tgtRaw);
  uColSettled.copy(tgtSettled);
  uColInk.copy(tgtInk);
  uColBg.copy(tgtBg);
  (linkMat.uniforms.uColLink.value as import("three").Color).copy(tgtLink);
  renderer.setClearColor(uColBg, 1);

  const lerpThemeColors = (k: number) => {
    if (appliedTheme !== themeRef.current) retargetTheme();
    uColRaw.lerp(tgtRaw, k);
    uColSettled.lerp(tgtSettled, k);
    uColInk.lerp(tgtInk, k);
    uColBg.lerp(tgtBg, k);
    (linkMat.uniforms.uColLink.value as import("three").Color).lerp(tgtLink, k);
    renderer.setClearColor(uColBg, 1);
  };

  // ----- render -----
  const renderFrame = (tSec: number, progress: number) => {
    uniforms.uTime.value = tSec;
    uniforms.uProgress.value = progress;
    syncInteractions(tSec);
    updateAgents(tSec, progress);
    updateLinks(tSec, progress);
    renderer.render(scene, camera);
  };

  let raf = 0;
  let startMs = 0;
  const loop = (nowMs: number) => {
    if (!startMs) startMs = nowMs;
    const tSec = (nowMs - startMs) / 1000;
    // Frame-rate-independent theme lerp toward target (~0.6s time constant).
    lerpThemeColors(1 - Math.exp(-(1 / 60) / THEME_LERP_TAU));
    renderFrame(tSec, progressRef.current);
    raf = requestAnimationFrame(loop);
  };

  // ----- context-lost -> graceful static fallback -----
  const onContextLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    drawFallback();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  // ------------------------------------------------------------------
  // Reduced motion: run the engine headless to the SETTLED state (progress
  // past chaos end) and render ONE static frame. No loop, no listeners.
  // ------------------------------------------------------------------
  if (reduce) {
    lerpThemeColors(1); // snap (already snapped, but ensure target)
    renderFrame(0, 1);
    const onResizeStatic = () => {
      resize();
      renderFrame(0, 1);
    };
    window.addEventListener("resize", onResizeStatic);
    return () => {
      window.removeEventListener("resize", onResizeStatic);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      disposeAll();
    };
  }

  // ----- live: listeners + rAF, pause on hidden tab -----
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerleave", onLeave);
  window.addEventListener("pointerdown", onDown);
  window.addEventListener("resize", resize);
  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf) {
      startMs = 0;
      raf = requestAnimationFrame(loop);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  raf = requestAnimationFrame(loop);

  function disposeAll() {
    geo.dispose();
    linkGeo.dispose();
    agentGeo.dispose();
    terrainMat.dispose();
    wireMat.dispose();
    agentMat.dispose();
    linkMat.dispose();
    renderer.dispose();
  }

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("pointerdown", onDown);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    disposeAll();
  };
}

// ============================================================================
// GLSL. The height functions below MUST match surfaceEngine.heightAt EXACTLY
// (every constant + term). See lib/hero/surfaceEngine.ts for the prose spec.
// ============================================================================

// Shared height field GLSL - injected into every vertex shader that displaces.
// MUST match surfaceEngine.heightAt (and its sub-functions) bit-for-bit.
const HEIGHT_GLSL = /* glsl */ `
  // --- engine constants (verbatim from surfaceEngine.ts) ---
  const float DOMAIN          = 1.0;
  const float SADDLE_X        = 0.45;
  const float SADDLE_Z        = 0.45;
  const float BASIN_AMP       = 0.06;
  const float BASIN_SIGMA     = 0.35;
  const float CHAOS_AMP       = 0.5;
  const float CHAOS_END       = 0.5;
  const float CHAOS_FREQ_A    = 3.1;
  const float CHAOS_FREQ_B    = 2.3;
  const float CHAOS_SPEED_A   = 0.7;
  const float CHAOS_SPEED_B   = 0.9;
  const float WELL_AMP        = 0.35;
  const float WELL_RADIUS     = 0.32;
  const float SHOCK_AMP       = 0.45;
  const float SHOCK_SPEED     = 0.9;
  const float SHOCK_WAVELENGTH= 0.45;
  const float SHOCK_TIME_DECAY= 1.6;
  const float SHOCK_SPACE_DECAY=2.2;
  const float SHOCK_AXIS_BIAS = 0.6;
  const float SETTLE_NORM     = 0.5; // == CHAOS_AMP
  const float PI_             = 3.14159265358979;
  // Two basin centers on z=0 valley line: (-0.55,0),(0.55,0).
  const vec2 BASIN_C0 = vec2(-0.55, 0.0);
  const vec2 BASIN_C1 = vec2( 0.55, 0.0);

  // MUST match surfaceEngine.equilibriumHeight
  float eqHeight(float x, float z) {
    float y = SADDLE_X * x * x - SADDLE_Z * z * z;
    float s2 = 2.0 * BASIN_SIGMA * BASIN_SIGMA;
    vec2 d0 = vec2(x, z) - BASIN_C0;
    vec2 d1 = vec2(x, z) - BASIN_C1;
    y -= BASIN_AMP * exp(-dot(d0, d0) / s2);
    y -= BASIN_AMP * exp(-dot(d1, d1) / s2);
    return y;
  }

  // MUST match surfaceEngine.chaosAmplitude
  float chaosAmp(float progress) {
    return CHAOS_AMP * (1.0 - smoothstep(0.0, CHAOS_END, progress));
  }

  // MUST match surfaceEngine.chaosHeight (early-return dropped; amp*... is 0)
  float chaosHeight(float x, float z, float t, float progress) {
    float amp = chaosAmp(progress);
    float a = sin(x * CHAOS_FREQ_A + t * CHAOS_SPEED_A)
            * cos(z * CHAOS_FREQ_A - t * CHAOS_SPEED_A);
    float b = sin((x + z) * CHAOS_FREQ_B + t * CHAOS_SPEED_B);
    return amp * 0.5 * (a + b);
  }

  // MUST match surfaceEngine.wellHeight. well = (x, z, strength).
  float wellHeight(float x, float z, vec3 w) {
    float dx = x - w.x;
    float dz = z - w.y;
    float r2 = dx * dx + dz * dz;
    return w.z * WELL_AMP * exp(-r2 / (2.0 * WELL_RADIUS * WELL_RADIUS));
  }

  // MUST match surfaceEngine.shockHeight. shock = (x, z, t0, strength).
  float shockHeight(float x, float z, float t, vec4 s) {
    float age = t - s.z;
    if (age < 0.0) return 0.0;
    float dx = x - s.x;
    float dz = z - s.y;
    float r = sqrt(dx * dx + dz * dz);
    float front = age * SHOCK_SPEED;
    float d = r - front;
    float timeEnv = exp(-SHOCK_TIME_DECAY * age);
    float spaceEnv = exp(-SHOCK_SPACE_DECAY * abs(d));
    float dirZ = r > 1e-6 ? abs(dz) / r : 1.0;
    float axis = 1.0 - SHOCK_AXIS_BIAS + SHOCK_AXIS_BIAS * dirZ;
    float wave = sin((2.0 * PI_ * d) / SHOCK_WAVELENGTH);
    return s.w * SHOCK_AMP * timeEnv * spaceEnv * axis * wave;
  }
`;

// Uniform decls shared by terrain + wire vertex shaders.
const HEIGHT_UNIFORMS = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform vec4  uWells[${MAX_WELLS}];   // (x, z, strength, _)
  uniform int   uWellCount;
  uniform vec4  uShocks[${MAX_SHOCKS}]; // (x, z, t0, strength)
  uniform int   uShockCount;
`;

// MUST match surfaceEngine.heightAt: eq + chaos + sum(wells) + sum(shocks).
const HEIGHT_AT_GLSL = /* glsl */ `
  float heightAt(float x, float z) {
    float y = eqHeight(x, z);
    y += chaosHeight(x, z, uTime, uProgress);
    for (int i = 0; i < ${MAX_WELLS}; i++) {
      if (i >= uWellCount) break;
      y += wellHeight(x, z, uWells[i].xyz);
    }
    for (int i = 0; i < ${MAX_SHOCKS}; i++) {
      if (i >= uShockCount) break;
      y += shockHeight(x, z, uTime, uShocks[i]);
    }
    return y;
  }
`;

// Vertex shader for the terrain + wire. Geometry is on XZ (plane rotated), so
// position.x -> engine x, position.z -> engine z. We REPLACE position.y with
// the engine height and pass the settledness scalar to the fragment shader.
const VERT = /* glsl */ `
  ${HEIGHT_UNIFORMS}
  ${HEIGHT_GLSL}
  ${HEIGHT_AT_GLSL}
  varying float vSettle;
  varying float vRidge; // signed: + near unstable ridge top, for ink rim
  void main() {
    float x = position.x;
    float z = position.z;
    float y = heightAt(x, z);
    // settledness = clamp(1 - smoothstep(0, SETTLE_NORM, |y - eq|), 0, 1)
    float disp = abs(y - eqHeight(x, z));
    vSettle = clamp(1.0 - smoothstep(0.0, SETTLE_NORM, disp), 0.0, 1.0);
    // Ridge cue: how high above the local valley line (z drives instability).
    vRidge = clamp(-z * 0.5 + 0.5, 0.0, 1.0);
    vec3 p = vec3(x, y, z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

// Terrain fragment: GRAFT 1 color rule. raw (dim) far from equilibrium, bloom
// toward settled in valleys. Ledger uses NORMAL blend with a darken-toward-raw
// base + thin ochre rim; phosphor uses additive bloom.
const FRAG_TERRAIN = /* glsl */ `
  precision highp float;
  uniform vec3  uColRaw;
  uniform vec3  uColSettled;
  uniform vec3  uColInk;
  uniform float uAdditive;
  varying float vSettle;
  varying float vRidge;
  void main() {
    float s = vSettle;
    if (uAdditive > 0.5) {
      // PHOSPHOR: additive oscilloscope bloom over near-black. Brightness is a
      // pure function of settledness; valleys bloom toward glow teal.
      vec3 col = mix(uColRaw, uColSettled, s);
      // dim raw chaos, bloom settled. terrain is a faint structural wash.
      float a = 0.06 + s * s * 0.22;
      gl_FragColor = vec4(col * (0.4 + s * 0.9), a);
    } else {
      // LEDGER: normal blend. Base is deep teal (raw); settled valleys get a
      // THIN ochre rim only, so glow never washes out on warm off-white. Keep
      // the terrain muted (low alpha) so copy stays legible above it.
      vec3 base = uColRaw;                       // deep teal everywhere
      float rim = smoothstep(0.7, 1.0, s);       // only the most-settled rim
      vec3 col = mix(base, uColSettled, rim * 0.6);
      float a = 0.10 + s * 0.16;                 // muted; darken-toward-teal
      gl_FragColor = vec4(col, a);
    }
  }
`;

// Wireframe fragment: a faint readout of the relief; brighter where settled.
const FRAG_WIRE = /* glsl */ `
  precision highp float;
  uniform vec3  uColRaw;
  uniform vec3  uColSettled;
  uniform vec3  uColInk;
  uniform float uAdditive;
  varying float vSettle;
  varying float vRidge;
  void main() {
    float s = vSettle;
    if (uAdditive > 0.5) {
      vec3 col = mix(uColRaw, uColSettled, s);
      gl_FragColor = vec4(col, 0.05 + s * 0.10);
    } else {
      // Deep-teal hairlines on Ledger; never additive.
      gl_FragColor = vec4(uColRaw, 0.06 + s * 0.06);
    }
  }
`;

// Agent vertex: positions are already engine-space world coords (CPU-sampled
// from heightAt, so dots sit ON the relief). Size attenuates with settledness.
const VERT_AGENT = /* glsl */ `
  uniform float uSize;
  attribute float aSettle;
  varying float vSettle;
  void main() {
    vSettle = aSettle;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Perspective size attenuation + a small bump as agents settle.
    gl_PointSize = uSize * (0.7 + aSettle * 0.8) * (1.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

// Agent fragment: round sprite. GRAFT 1 - halo blooms with settledness. On
// Ledger (normal blend) the dot is deep teal with an ochre rim; on Phosphor
// the dot is sky with an additive teal halo.
const FRAG_AGENT = /* glsl */ `
  precision highp float;
  uniform vec3  uColRaw;
  uniform vec3  uColSettled;
  uniform float uAdditive;
  varying float vSettle;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;
    float core = 1.0 - smoothstep(0.0, 0.5, r);   // solid center
    float halo = 1.0 - smoothstep(0.5, 1.0, r);   // soft ring
    if (uAdditive > 0.5) {
      // PHOSPHOR additive: sky core, teal halo that blooms when settled.
      vec3 col = mix(uColRaw, uColSettled, vSettle);
      float a = core * (0.5 + vSettle * 0.5) + halo * vSettle * 0.5;
      gl_FragColor = vec4(col, a);
    } else {
      // LEDGER normal: deep-teal core, thin ochre rim only when settled.
      float rimMask = halo * (1.0 - core);
      vec3 col = mix(uColRaw, uColSettled, rimMask * vSettle);
      float a = core * 0.95 + rimMask * (0.25 + vSettle * 0.4);
      gl_FragColor = vec4(col, a);
    }
  }
`;

// Link vertex: per-vertex alpha (settledness-driven) passed to fragment.
const VERT_LINK = /* glsl */ `
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Link fragment: emergent network edges. Brightness = endpoint settledness.
const FRAG_LINK = /* glsl */ `
  precision highp float;
  uniform vec3  uColLink;
  uniform float uAdditive;
  varying float vAlpha;
  void main() {
    float a = uAdditive > 0.5 ? vAlpha * 0.55 : vAlpha * 0.5;
    gl_FragColor = vec4(uColLink, a);
  }
`;
