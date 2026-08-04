// Framework-agnostic types for the Dotted World Map engine.
// `Config` is the single source of truth for all render + UI state.

import type { Bezier } from "./easing";

export type Shape = "circle" | "square" | "diamond";
export type Intro = "none" | "reveal";
// Crest band render: normal dots, or the ASCII "decode sweep" (scrambling glyphs that settle)
export type CrestStyle = "dots" | "ascii";

// Reveal — how each dot moves into place (layered on the reveal order)
export type RevMotion = "none" | "rise" | "fall" | "scatter" | "directional";
// Reveal — what ORDER dots appear in: a directional sweep, patches growing from seeds, or a
// concentric wave bursting outward from the map centre.
export type RevPattern = "sweep" | "spotty" | "radial";

export interface Config {
  // global / dots
  gap: number;
  size: number;
  shape: Shape;
  color: string;
  bg: string;
  zoom: number;
  intro: Intro; // gate: "reveal" runs the load animation, "none" draws the settled grid
  // reveal — ① timing
  rvSpeed: number; // global speed (÷ into the fixed base duration)
  rvDelay: number; // delay before it starts (ms)
  rvEase: Bezier; // cubic-bézier for how the sweep front accelerates/decelerates
  rvSpeedLink: boolean; // opacity + scale Speed follow the main Speed (vs their own offset)
  rvEaseLink: boolean; // opacity + scale easing follow the main sweep curve (vs their own)
  // reveal — ② pattern (how the reveal ORDER is assigned)
  rvPattern: RevPattern; // "sweep" (directional) or "spotty" (patches grow from seeds)
  // sweep pattern
  rvAngle: number; // sweep direction in degrees (0 = top→bottom)
  rvStagger: number; // 0 = all dots at once, 1 = fully sequential across the sweep
  rvCurveBow: number; // front curvature (bow-in .. bow-out)
  // spotty pattern
  rvSpotCount: number; // number of seed points (few large patches ↔ many small)
  rvSpotSpread: number; // patch growth speed (× on the reveal pace)
  rvSpotEdge: number; // soft edge band width (fraction of the normalized distance range)
  rvSpotSeed: number; // PRNG seed for seed placement — re-roll bumps this
  rvSpotBlob: number; // blob warp amount (0 = circular fronts, higher = organic fBm blobs)
  rvSpotBlobScale: number; // blob noise frequency (low = zoomed-in large blobs)
  // radial pattern (concentric wave bursting from an origin; order = distance from that origin)
  rvOriginX: number; // wave origin X, 0..1 across the map width (0.5 = centre)
  rvOriginY: number; // wave origin Y, 0..1 down the map height (0.5 = centre)
  rvOriginSize: number; // birth-area radius (0..1 of the reach): 0 = a point, higher = born from an area
  rvOriginSoft: number; // birth-area edge softness (0..1): 0 = hard edge, 1 = very feathered
  rvSquish: number; // crest compression — leading rings pulled inward (px); high values pile/overlap
  rvSquishWidth: number; // how far behind the front the compression reaches (normalized reveal units)
  rvFoam: number; // chaotic scatter at the crest — shimmering froth that fades to calm behind (0..1)
  rvFoamDot: number; // dot-size multiplier where the foam is (1 = same, >1 bigger, <1 smaller)
  // reveal — ③ opacity track
  rvFade: number; // per-dot start opacity (0 = fade from invisible)
  rvOpacEase: Bezier; // opacity easing (cubic-bézier)
  rvOpacSpeed: number; // opacity transition speed (snappier ↔ slower)
  rvOpacDelay: number; // opacity start delay (ms)
  // reveal — ④ scale track
  rvScale: number; // per-dot start scale (0 = grow from nothing)
  rvScaleEase: Bezier; // scale easing (cubic-bézier)
  rvScaleSpeed: number; // scale transition speed (snappier ↔ slower)
  rvScaleDelay: number; // scale start delay (ms)
  // reveal — ⑤ motion into place (same shape as opacity/scale: easing · speed · delay)
  rvMotion: RevMotion; // per-dot motion into place
  rvMotionDist: number; // motion distance (px) — used by rise/fall/scatter
  // directional: every dot starts at a uniform (X,Y) offset (the whole map shifted), then a
  // spring pulls it home once released. Stiffness = pull strength, Elasticity = overshoot.
  rvDirX: number; // directional start offset X (px)
  rvDirY: number; // directional start offset Y (px)
  rvStiffness: number; // spring stiffness 0..1
  rvElasticity: number; // spring elasticity / bounce 0..1
  rvDirDelay: number; // spring-release delay ramped along the sweep (s) — the delay gradient
  rvDirDelayJit: number; // random per-dot component added to the release delay (s)
  rvDirSpread: number; // start offset scales along the sweep (0 = uniform, 1 = near→far parallax)
  rvMotionEase: Bezier; // motion easing (cubic-bézier)
  rvMotionSpeed: number; // motion transition speed (snappier ↔ slower)
  rvMotionDelay: number; // motion start delay (ms)
  // reveal — ⑥ edge effects (three independent effects on the reveal wavefront)
  rvEdgeSharp: number; // #1 opacity: crisp/aggressive (1) ↔ soft/natural (0) reveal boundary
  rvEdgeComp: number; // #2 position: dots bunch forward at the leading edge, then relax
  rvHi: number; // #3 size/brightness: intensity burst on the edge (0 = off)
  rvHiWidth: number; // burst band width (0..1)
  // reveal — ⑦ crest (hero effects on the leading-edge band that travels with the front)
  rvCrestArea: number; // width of the crest band behind the front (normalized reveal units)
  rvChaos: number; // per-frame position jitter in the crest → sparkle (0 = still, 1 = chaotic)
  rvSpray: number; // scatter of faint dots flung just ahead of the crest — foam (0..1)
  // blinker: crest dots flicker on/off, settling to ON toward the back of the band
  rvBlinkRate: number; // toggle frequency (Hz)
  rvBlinkAmt: number; // blink intensity — off-probability at the front of the crest (0..1)
  rvBlinkDim: number; // "off" brightness: 0 = fully off (blink) ↔ 1 = barely dims (twinkle)
  // crest ASCII decode: the leading-edge band renders as monospace glyphs that scramble at the
  // front and resolve into their settled character (then swap back to dots) as the front passes.
  rvCrestStyle: CrestStyle; // "dots" (default) or "ascii" decode sweep
  rvAsciiGlyphs: string; // glyph ramp, light→heavy; a dot's char = brightness tier + noise pick
  rvAsciiRate: number; // scramble refresh rate (Hz) — how fast glyphs cycle before locking
  rvAsciiVariety: number; // randomness within a brightness tier (0 = pure ramp, 1 = noisy)
  rvAsciiFade: number; // trailing-edge crossfade: fraction of the band where glyph→dot dissolves
  // reveal — ⑧ organic randomness
  rvJitterTime: number; // reveal-time jitter (0..1)
  rvJitterAppear: number; // appearance jitter (0..1)
}

export const DEFAULT_CONFIG: Config = {
  gap: 6,
  size: 1.3,
  shape: "circle",
  color: "#0387ff",
  bg: "#ffffff",
  zoom: 1,
  intro: "reveal",
  // reveal defaults — dialed in by the user (Spotty, blobby, directional parallax spring)
  rvSpeed: 0.6,
  rvDelay: 0,
  rvEase: [0.05831564284985719, 0.163830985915493, 0.2976352126682986, 0.9982732394366198],
  rvSpeedLink: false,
  rvEaseLink: false,
  rvPattern: "sweep",
  rvAngle: 0,
  rvStagger: 1,
  rvCurveBow: -1.3,
  rvSpotCount: 12,
  rvSpotSpread: 0.85,
  rvSpotEdge: 0.41,
  rvSpotSeed: 6,
  rvSpotBlob: 0.2,
  rvSpotBlobScale: 3.9,
  rvOriginX: 0.5,
  rvOriginY: 0.5,
  rvOriginSize: 0.1,
  rvOriginSoft: 0.5,
  rvSquish: 80,
  rvSquishWidth: 0.18,
  rvFoam: 0.45,
  rvFoamDot: 1.4,
  rvFade: 0,
  rvOpacEase: [0.7337614111587109, 0.020265492957746573, 0.718640828998368, 0.9628436619718309],
  rvOpacSpeed: 3.05,
  rvOpacDelay: 0,
  rvScale: 0,
  rvScaleEase: [0.25, 0.1, 0.25, 1],
  rvScaleSpeed: 3.05,
  rvScaleDelay: 0,
  rvMotion: "directional",
  rvMotionDist: 18,
  rvDirX: -40,
  rvDirY: -40,
  rvStiffness: 0,
  rvElasticity: 0.13,
  rvDirDelay: 0,
  rvDirDelayJit: 0,
  rvDirSpread: 1,
  rvMotionEase: [0.42, 0, 0.58, 1],
  rvMotionSpeed: 3.05,
  rvMotionDelay: 0,
  rvEdgeSharp: 0,
  rvEdgeComp: 0.4,
  rvHi: 1,
  rvHiWidth: 0.5,
  rvCrestArea: 0.22,
  rvChaos: 0,
  rvSpray: 0,
  rvBlinkRate: 11,
  rvBlinkAmt: 0.56,
  rvBlinkDim: 0.25,
  rvCrestStyle: "dots",
  rvAsciiGlyphs: "01XO",
  rvAsciiRate: 14,
  rvAsciiVariety: 0.4,
  rvAsciiFade: 0.4,
  rvJitterTime: 0.06,
  rvJitterAppear: 0,
};
