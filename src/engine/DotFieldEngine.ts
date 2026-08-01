// DotFieldEngine — framework-agnostic Canvas 2D renderer.
// Owns all runtime/derived state (mask, dots, feature field, particle sim);
// reads a plain `Config` snapshot each frame. React feeds it config via setConfig().

import type { Config } from "./types";
import { ease } from "./easing";

const W = 1800;
const TAU = Math.PI * 2;
const WIN_BASE = 0.65; // base per-dot reveal window; the track Speed divides into it
const DUR_BASE = 3200; // base reveal duration (ms); the global Speed divides into it

/** Small deterministic PRNG (mulberry32) so Spotty's seed placement is reproducible per seed. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- fractal value noise (for Spotty blob-warping the patch fronts) ---- */
function hash2(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const xf = x - xi,
    yf = y - yi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi),
    b = hash2(xi + 1, yi),
    c = hash2(xi, yi + 1),
    d = hash2(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
/** 4-octave fBm, normalized to ~0..1. */
function fbm(x: number, y: number): number {
  let f = 0,
    amp = 0.5,
    freq = 1,
    norm = 0;
  for (let o = 0; o < 4; o++) {
    f += amp * vnoise(x * freq, y * freq);
    norm += amp;
    freq *= 2;
    amp *= 0.5;
  }
  return f / norm;
}

interface Dot {
  x: number; // home anchor X (grid position; never mutated by animation)
  y: number; // home anchor Y
  offX: number; // per-dot base displacement from home (0 = pinned exactly at home)
  offY: number;
  size: number; // per-dot base size multiplier (1 = default)
  opacity: number; // per-dot base opacity (1 = default)
  vx: number; // velocity for opt-in physics (0 when pinned)
  vy: number;
  ph: number; // random phase 0..2π (scatter direction / jitter)
  rand: number; // random 0..1 (time jitter)
  edgeDist: number;
  introT: number; // reveal order along the sweep direction (0..1)
  alongN: number; // clean normalized along-sweep position (0..1), no curve-bow warp
  perp: number; // reveal coord perpendicular to the sweep (0..1) — drives wave & bow
  sox: number; // directional spring: current live offset from home (x)
  soy: number; // directional spring: current live offset from home (y)
  released: boolean; // directional spring: has the dot started springing home?
  actTime: number; // ms when this dot's reveal began (-1 = not yet) — gates the release delay
  relDelay: number; // ms from actTime until the spring releases (gradient + jitter)
}
interface EngineOptions {
  onDotCount?: (n: number) => void;
  onSize?: (w: number, h: number) => void;
}

export class DotFieldEngine {
  readonly W = W;
  H = 900;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cfg: Config;
  private opts: EngineOptions;

  private svgImg = new Image();
  private mask: Uint8ClampedArray | null = null;
  private dots: Dot[] = [];

  private introStart = 0;
  private raf = 0;
  private lastTs = 0; // previous rAF timestamp — for the directional spring's dt
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement, cfg: Config, opts: EngineOptions = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cfg = cfg;
    this.opts = opts;
  }

  load(url = "/map.svg"): void {
    this.svgImg.onload = () => {
      if (this.destroyed) return;
      this.H = Math.round(W * (this.svgImg.height / this.svgImg.width));
      this.canvas.width = W;
      this.canvas.height = this.H;
      this.buildMask();
      this.buildDots();
      this.opts.onSize?.(W, this.H);
      this.introStart = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    };
    this.svgImg.src = url;
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
  }

  /** Merge a fresh config snapshot and trigger the minimal rebuilds it implies. */
  setConfig(next: Config): void {
    const prev = this.cfg;
    this.cfg = next;
    if (!this.mask) return; // not loaded yet — load() will build from current cfg

    if (next.gap !== prev.gap) {
      this.buildDots(); // rebuilds dots + reassigns reveal order
    } else if (
      next.rvPattern !== prev.rvPattern ||
      next.rvAngle !== prev.rvAngle ||
      next.rvCurveBow !== prev.rvCurveBow ||
      next.rvSpotCount !== prev.rvSpotCount ||
      next.rvSpotSeed !== prev.rvSpotSeed ||
      next.rvSpotBlob !== prev.rvSpotBlob ||
      next.rvSpotBlobScale !== prev.rvSpotBlobScale
    ) {
      this.assignOrder(); // pattern / sweep geometry / seeds changed → recompute order
    }

    if (next.intro !== prev.intro) this.introStart = performance.now();
  }

  /** Restart the reveal from the top. */
  replayIntro(): void {
    this.introStart = performance.now();
    this.resetSpring();
  }

  /** Linear reveal playhead 0..1 on the global clock (elapsed·speed ÷ base duration, after the
   * start delay). Not eased — it reads as a real timeline. 1 when the reveal isn't running. */
  getProgress(): number {
    if (this.cfg.intro !== "reveal") return 1;
    const elapsed = performance.now() - this.introStart - this.cfg.rvDelay;
    if (elapsed <= 0) return 0;
    const p = (elapsed * this.cfg.rvSpeed) / DUR_BASE;
    return p >= 1 ? 1 : p;
  }

  /* ---------- land mask ---------- */
  private isLand(x: number, y: number): boolean {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= this.H) return false;
    return this.mask![(y * W + x) * 4 + 3] > 120;
  }

  private buildMask(): void {
    const off = document.createElement("canvas");
    off.width = W;
    off.height = this.H;
    const octx = off.getContext("2d")!;
    octx.drawImage(this.svgImg, 0, 0, W, this.H);
    this.mask = octx.getImageData(0, 0, W, this.H).data;
  }

  /* ---------- dot field ---------- */
  private buildDots(): void {
    const H = this.H;
    const g = this.cfg.gap;
    const xs: number[] = [];
    for (let x = g / 2; x < W; x += g) xs.push(x);
    const ys: number[] = [];
    for (let y = g / 2; y < H; y += g) ys.push(y);
    const nx = xs.length,
      ny = ys.length;
    const land: boolean[][] = [];
    for (let j = 0; j < ny; j++) {
      land[j] = [];
      for (let i = 0; i < nx; i++) land[j][i] = this.isLand(xs[i], ys[j]);
    }
    // chamfer distance to nearest water (grid units)
    const INF = 1e9,
      D1 = 1,
      D2 = 1.4142136;
    const dist: number[][] = [];
    for (let j = 0; j < ny; j++) {
      dist[j] = [];
      for (let i = 0; i < nx; i++) dist[j][i] = land[j][i] ? INF : 0;
    }
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        if (!land[j][i]) continue;
        let d = dist[j][i];
        if (j > 0) {
          d = Math.min(d, dist[j - 1][i] + D1);
          if (i > 0) d = Math.min(d, dist[j - 1][i - 1] + D2);
          if (i < nx - 1) d = Math.min(d, dist[j - 1][i + 1] + D2);
        }
        if (i > 0) d = Math.min(d, dist[j][i - 1] + D1);
        dist[j][i] = d;
      }
    for (let j = ny - 1; j >= 0; j--)
      for (let i = nx - 1; i >= 0; i--) {
        if (!land[j][i]) continue;
        let d = dist[j][i];
        if (j < ny - 1) {
          d = Math.min(d, dist[j + 1][i] + D1);
          if (i < nx - 1) d = Math.min(d, dist[j + 1][i + 1] + D2);
          if (i > 0) d = Math.min(d, dist[j + 1][i - 1] + D2);
        }
        if (i < nx - 1) d = Math.min(d, dist[j][i + 1] + D1);
        dist[j][i] = d;
      }
    this.dots = [];
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        if (!land[j][i]) continue;
        this.dots.push({
          x: xs[i],
          y: ys[j],
          offX: 0,
          offY: 0,
          size: 1,
          opacity: 1,
          vx: 0,
          vy: 0,
          ph: Math.random() * TAU,
          rand: Math.random(),
          edgeDist: dist[j][i],
          introT: 0,
          alongN: 0,
          perp: 0,
          sox: 0,
          soy: 0,
          released: false,
          actTime: -1,
          relDelay: 0,
        });
      }
    this.assignOrder();
    this.resetSpring();
    this.opts.onDotCount?.(this.dots.length);
  }

  /** Assign each dot's reveal order (introT) per the active pattern. */
  private assignOrder(): void {
    if (this.cfg.rvPattern === "spotty") this.assignSpotty();
    else this.assignReveal();
  }

  /**
   * Spotty order: scatter N seeds (seeded PRNG so re-roll is reproducible), then set each dot's
   * introT to its normalized distance to the NEAREST seed. Dots at a seed → 0 (reveal first),
   * farthest → 1. Nearest-seed means patch territories meet at the midlines and fill the map.
   * alongN mirrors introT so directional parallax works along the seed-distance gradient.
   */
  private assignSpotty(): void {
    const n = this.dots.length;
    if (!n) return;
    const rng = mulberry32((this.cfg.rvSpotSeed | 0) * 0x9e3779b1 || 1);
    const count = Math.max(1, Math.round(this.cfg.rvSpotCount));
    const seeds: { x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
      const d = this.dots[Math.floor(rng() * n)];
      seeds.push({ x: d.x, y: d.y });
    }
    // blob warp: perturb the distance with fBm so the circular fronts become organic blobs.
    // Sampled isotropically (both axes ÷ W); the seed shifts the field so re-roll reshapes it.
    const blobAmp = this.cfg.rvSpotBlob * 600;
    const blobFreq = Math.max(0.2, this.cfg.rvSpotBlobScale);
    const noff = (this.cfg.rvSpotSeed % 131) * 2.7;
    let dmax = 0;
    for (const d of this.dots) {
      let best = Infinity;
      for (const s of seeds) {
        const dx = d.x - s.x,
          dy = d.y - s.y;
        const dd = dx * dx + dy * dy;
        if (dd < best) best = dd;
      }
      let dist = Math.sqrt(best);
      if (blobAmp > 0) {
        const w = (fbm((d.x / W) * blobFreq + noff, (d.y / W) * blobFreq + noff) - 0.5) * 2;
        dist += blobAmp * w;
        if (dist < 0) dist = 0;
      }
      d.introT = dist;
      if (d.introT > dmax) dmax = d.introT;
    }
    const inv = dmax > 0 ? 1 / dmax : 1;
    for (const d of this.dots) {
      d.introT *= inv;
      d.alongN = d.introT;
      d.perp = 0;
    }
  }

  /** Reset the directional spring: park every dot at the start offset, zero velocity. */
  private resetSpring(): void {
    for (const d of this.dots) {
      d.sox = this.cfg.rvDirX;
      d.soy = this.cfg.rvDirY;
      d.vx = 0;
      d.vy = 0;
      d.released = false;
      d.actTime = -1;
      d.relDelay = 0;
    }
  }

  /* ---------- reveal scheduling ---------- */
  /**
   * Precompute, for the current sweep angle + curve bow, each dot's reveal order
   * (introT, 0..1) and its coord perpendicular to the sweep (perp, 0..1). The curve bow
   * is folded in HERE and the result renormalized to [0,1] — so even extreme bow spreads
   * the dots smoothly instead of piling them at a clamp (which caused the "jump").
   * Recomputed only when angle / bow / grid change; time-varying bits stay in the loop.
   */
  private assignReveal(): void {
    const cfg = this.cfg;
    const th = (cfg.rvAngle * Math.PI) / 180;
    const s = Math.sin(th),
      c = Math.cos(th); // sweep dir = (s, c): 0°=top→bottom, 90°=left→right
    let amin = Infinity,
      amax = -Infinity,
      pmin = Infinity,
      pmax = -Infinity;
    for (const d of this.dots) {
      const along = d.x * s + d.y * c;
      const perp = d.x * c - d.y * s;
      d.introT = along;
      d.perp = perp;
      if (along < amin) amin = along;
      if (along > amax) amax = along;
      if (perp < pmin) pmin = perp;
      if (perp > pmax) pmax = perp;
    }
    const ar = amax - amin || 1,
      pr = pmax - pmin || 1;
    // normalize along→introT and perp, then bow the order and renormalize (no clamping)
    let omin = Infinity,
      omax = -Infinity;
    const ords = new Float64Array(this.dots.length);
    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i];
      d.perp = (d.perp - pmin) / pr;
      const base = (d.introT - amin) / ar;
      d.alongN = base; // clean spatial gradient for offset spread (unaffected by curve bow)
      const bow = cfg.rvCurveBow * (1 - 4 * (d.perp - 0.5) * (d.perp - 0.5)) * 0.4;
      const o = base + bow;
      ords[i] = o;
      if (o < omin) omin = o;
      if (o > omax) omax = o;
    }
    const or = omax - omin || 1;
    for (let i = 0; i < this.dots.length; i++) this.dots[i].introT = (ords[i] - omin) / or;
  }

  /** Global reveal progress 0..1 (after delay), shaped by the rvEase bézier. */
  private revealProgress(now: number): number {
    return this.revealProgressOn(now, DUR_BASE, this.cfg.rvSpeed);
  }

  /** Reveal progress 0..1 on the global clock (dur ÷ speed), shaped by rvEase, with an extra
   * per-track `delay` (ms) — opacity and scale each offset their start by their own delay. */
  private revealProgressOn(now: number, dur: number, speed: number, delay = 0): number {
    const cfg = this.cfg;
    const elapsed = now - this.introStart - cfg.rvDelay - delay;
    if (elapsed <= 0) return 0;
    const p = Math.min(1, (elapsed * speed) / Math.max(1, dur));
    return ease(p, cfg.rvEase);
  }

  /** Like revealProgress but does NOT clamp at 1 — it eases to 1 then continues linearly, so the
   * crest band keeps travelling off the map after completion (leaving a clean settled grid). */
  private frontUncapped(now: number, speed: number): number {
    const cfg = this.cfg;
    const elapsed = now - this.introStart - cfg.rvDelay;
    if (elapsed <= 0) return 0;
    const p = (elapsed * speed) / DUR_BASE;
    return p >= 1 ? 1 + (p - 1) : ease(p, cfg.rvEase);
  }

  /* ---------- rendering ---------- */
  private shapePath(x: number, y: number, s: number): void {
    const ctx = this.ctx;
    if (this.cfg.shape === "circle") {
      ctx.moveTo(x + s, y);
      ctx.arc(x, y, s, 0, Math.PI * 2);
    } else if (this.cfg.shape === "square") {
      ctx.rect(x - s, y - s, s * 2, s * 2);
    } else {
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s, y);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s, y);
      ctx.closePath();
    }
  }

  private loop = (ts: number): void => {
    if (this.destroyed) return;
    const cfg = this.cfg,
      ctx = this.ctx,
      H = this.H;
    const now = performance.now();
    // dt for the directional spring (clamped so a slow/first frame can't blow it up)
    const dt = this.lastTs ? Math.min(0.033, (ts - this.lastTs) / 1000) : 0;
    this.lastTs = ts;
    ctx.fillStyle = cfg.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = cfg.color;
    const reveal = cfg.intro === "reveal";
    const Pe = reveal ? this.revealProgress(now) : 1; // motion / global clock
    // opacity + scale share the global clock but each offset by its own Delay
    const PeO = reveal ? this.revealProgressOn(now, DUR_BASE, cfg.rvSpeed, cfg.rvOpacDelay) : 1;
    const PeS = reveal ? this.revealProgressOn(now, DUR_BASE, cfg.rvSpeed, cfg.rvScaleDelay) : 1;
    const PeM = reveal ? this.revealProgressOn(now, DUR_BASE, cfg.rvSpeed, cfg.rvMotionDelay) : 1;
    // per-dot window: opacity/scale from a single Speed (base ÷ speed); motion from dur ÷ speed.
    // When linked, opacity/scale borrow the main Speed / main easing instead of their own.
    const opSpeed = cfg.rvSpeedLink ? cfg.rvSpeed : cfg.rvOpacSpeed;
    const scSpeed = cfg.rvSpeedLink ? cfg.rvSpeed : cfg.rvScaleSpeed;
    const opEase = cfg.rvEaseLink ? cfg.rvEase : cfg.rvOpacEase;
    const scEase = cfg.rvEaseLink ? cfg.rvEase : cfg.rvScaleEase;
    const winO = Math.max(0.02, Math.min(1, WIN_BASE / opSpeed));
    const winS = Math.max(0.02, Math.min(1, WIN_BASE / scSpeed));
    const winM = Math.max(0.02, Math.min(1, WIN_BASE / cfg.rvMotionSpeed));
    const hiW = Math.max(0.02, cfg.rvHiWidth);
    // edge effects: sweep unit vector (for compression bunching) + reveal-sharpen steepness
    const rth = (cfg.rvAngle * Math.PI) / 180;
    const swX = Math.sin(rth);
    const swY = Math.cos(rth);
    const sharpen = 1 + cfg.rvEdgeSharp * 8; // >1 steepens the reveal opacity transition
    const compOn = reveal && cfg.rvEdgeComp > 0 && Pe < 1;
    // directional spring: k = pull strength (from Stiffness), c = damping (from Elasticity —
    // less damping = more overshoot/bounce). Critically damped at elasticity 0, springy at 1.
    const dirMode = cfg.rvMotion === "directional";
    const k = 20 + cfg.rvStiffness * 280;
    const c = 2 * Math.sqrt(k) * (1 - cfg.rvElasticity * 0.85);
    // spotty pattern: a soft front (radius) grows over its own clock (Spread ×'s the pace).
    // front reaches 1+edge at completion so the farthest dots finish → the map fills.
    const spotty = cfg.rvPattern === "spotty";
    const spEdge = Math.max(0.02, cfg.rvSpotEdge);
    const spSpeed = cfg.rvSpeed * Math.max(0.05, cfg.rvSpotSpread);
    const spFront = !reveal ? Infinity : this.revealProgressOn(now, DUR_BASE, spSpeed) * (1 + spEdge);
    // ⑦ Crest: a band of width `area` travelling with the front. Its front is UNCAPPED so the
    // band clears off the map after completion. `frontCross` (per dot) = how far it has passed.
    const crestArea = Math.max(0.02, cfg.rvCrestArea);
    const crestFront = !reveal
      ? 1e9
      : spotty
        ? this.frontUncapped(now, spSpeed) * (1 + spEdge)
        : this.frontUncapped(now, cfg.rvSpeed);
    // align the crest to where dots actually appear: spotty reveals at spFront≈introT (mul 1);
    // sweep reveals at Pe≈introT·stagger·(1−winO), so scale introT by that so frontCross=0 there.
    const crestIntroMul = spotty ? 1 : cfg.rvStagger * (1 - winO);
    // ASCII decode: within the crest band, dots draw as scrambling monospace glyphs that resolve
    // as the front passes. Glyphs are sized to the cell (gap), independent of the scale track.
    const asciiOn = reveal && cfg.rvCrestStyle === "ascii";
    const asciiRamp = cfg.rvAsciiGlyphs || "01";
    const asciiN = asciiRamp.length;
    const asciiStep = ((now * Math.max(1, cfg.rvAsciiRate)) / 1000) | 0; // glyph-cycle clock (Hz)
    if (asciiOn) {
      ctx.font = `${Math.max(4, cfg.gap * 1.5)}px "Cutive Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
    }
    const crestOn = reveal && (cfg.rvChaos > 0 || cfg.rvSpray > 0 || cfg.rvBlinkAmt > 0);
    const bandOn = crestOn || asciiOn; // per-dot crest work runs when any band effect is active
    const crestSh = crestArea * 0.35; // soft shoulders of the band envelope
    const chaosAmp = cfg.rvChaos * cfg.gap * 1.5; // contained within ~a cell
    const chaosFrame = (now / 40) | 0; // ~25 Hz sparkle
    const blinkStep = ((now * cfg.rvBlinkRate) / 1000) | 0; // increments at the blink rate (Hz)

    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i];
      let m = 1,
        a = 1,
        rox = 0,
        roy = 0;
      let glyph = ""; // non-empty → draw this ASCII char instead of the dot shape (crest band)
      let dotMix = 0; // ascii back-edge crossfade: 0 = pure glyph, 1 = fully dissolved to the dot

      if (reveal) {
        let eMotion: number; // 0..1 reveal progress that drives motion (rise/fall/scatter)
        let mActivated: boolean; // has this dot's reveal begun (gates the directional spring)
        let compQ = 1; // motion-front progress for edge compression (sweep only)

        if (spotty) {
          // patches grow from seeds: a dot reveals as the front passes its seed-distance
          // (introT), fading over the soft `spEdge` band (smoothstep) — the blurry/matte edge.
          const cross = spFront - d.introT; // how far the front has passed this dot
          let es = cross / spEdge;
          if (es < 0) es = 0;
          else if (es > 1) es = 1;
          es = es * es * (3 - 2 * es); // smoothstep → soft shoulders
          a = cfg.rvFade + (1 - cfg.rvFade) * ease(es, opEase);
          m = cfg.rvScale + (1 - cfg.rvScale) * ease(es, scEase);
          eMotion = es;
          mActivated = spFront > d.introT;
        } else {
          // reveal order (sweep + curve bow) is baked into introT; add live time jitter
          const jit = cfg.rvJitterTime * (d.rand - 0.5);
          let order = d.introT + jit;
          if (order < 0) order = 0;
          else if (order > 1) order = 1;
          // stagger spreads each dot's start time; each track then reveals over its own window
          const stag = order * cfg.rvStagger;
          const appJit = cfg.rvJitterAppear > 0 ? (d.ph / TAU - 0.5) * cfg.rvJitterAppear : 0;

          // opacity track — own clock (PeO) + easing/window, appearance jitter & sharpness
          let qO = (PeO - stag * (1 - winO)) / winO;
          if (qO < 0) qO = 0;
          else if (qO > 1) qO = 1;
          let eO = ease(qO, opEase);
          if (appJit) {
            eO += appJit * (1 - eO);
            if (eO < 0) eO = 0;
            else if (eO > 1) eO = 1;
          }
          if (sharpen > 1.001) {
            const ec = eO < 0 ? 0 : eO > 1 ? 1 : eO;
            eO = (ec - 0.5) * sharpen + 0.5;
            if (eO < 0) eO = 0;
            else if (eO > 1) eO = 1;
          }
          a = cfg.rvFade + (1 - cfg.rvFade) * eO;

          // scale track
          let qS = (PeS - stag * (1 - winS)) / winS;
          if (qS < 0) qS = 0;
          else if (qS > 1) qS = 1;
          let eS = ease(qS, scEase);
          if (appJit) {
            eS += appJit * (1 - eS);
            if (eS < 0) eS = 0;
            else if (eS > 1) eS = 1;
          }
          m = cfg.rvScale + (1 - cfg.rvScale) * eS;

          // motion track
          let qM = (PeM - stag * (1 - winM)) / winM;
          if (qM < 0) qM = 0;
          else if (qM > 1) qM = 1;
          eMotion = ease(qM, cfg.rvMotionEase);
          mActivated = qM > 0;
          compQ = qM;

          // leading-edge highlight (burst) — sweep only
          if (cfg.rvHi > 0) {
            const dd = Math.abs(qO - 0.28);
            if (dd < hiW) {
              const hi = cfg.rvHi * (1 - dd / hiW);
              a *= 1 + hi;
              m *= 1 + hi * 0.6;
            }
          }
        }

        // motion into place — shared across patterns; driven by eMotion / mActivated
        if (dirMode) {
          // directional spring. Start offset scales along the order gradient (parallax spread).
          const spreadF = 1 - cfg.rvDirSpread * (1 - d.alongN);
          if (!d.released) {
            if (d.actTime < 0) {
              if (mActivated) {
                d.actTime = now;
                d.relDelay = (cfg.rvDirDelay * d.introT + cfg.rvDirDelayJit * d.rand) * 1000;
              }
            }
            if (d.actTime >= 0 && now - d.actTime >= d.relDelay) d.released = true;
          }
          if (!d.released) {
            d.sox = cfg.rvDirX * spreadF;
            d.soy = cfg.rvDirY * spreadF;
            d.vx = 0;
            d.vy = 0;
          }
          if (d.released) {
            const ax = -k * d.sox - c * d.vx;
            const ay = -k * d.soy - c * d.vy;
            d.vx += ax * dt;
            d.vy += ay * dt;
            d.sox += d.vx * dt;
            d.soy += d.vy * dt;
            if (Math.abs(d.sox) < 0.05 && Math.abs(d.vx) < 0.05) (d.sox = 0), (d.vx = 0);
            if (Math.abs(d.soy) < 0.05 && Math.abs(d.vy) < 0.05) (d.soy = 0), (d.vy = 0);
          }
          rox = d.sox;
          roy = d.soy;
        } else {
          const rem = (1 - eMotion) * cfg.rvMotionDist;
          if (rem > 0.01) {
            if (cfg.rvMotion === "rise") roy = rem;
            else if (cfg.rvMotion === "fall") roy = -rem;
            else if (cfg.rvMotion === "scatter") {
              rox = Math.cos(d.ph) * rem;
              roy = Math.sin(d.ph) * rem;
            }
          }
        }

        // #2 edge compression — sweep only (bunches dots forward at the leading edge)
        if (!spotty && compOn) {
          const comp = cfg.rvEdgeComp * Math.exp(-compQ * 4) * (1 - Pe) * 22;
          rox += swX * comp;
          roy += swY * comp;
        }
        // ⑦ Crest — effects on the band travelling with the front. `frontCross` = how far the
        // (uncapped) front has passed this dot; the band is [0, area] behind it.
        if (bandOn) {
          const frontCross = crestFront - d.introT * crestIntroMul;
          if (frontCross > 0 && frontCross < crestArea) {
            // Chaos — contained per-frame position jitter → sparkle (trapezoid envelope)
            if (chaosAmp > 0) {
              let env = Math.min(frontCross / crestSh, (crestArea - frontCross) / crestSh);
              if (env > 1) env = 1;
              if (env > 0) {
                rox += (hash2(i * 2, chaosFrame) - 0.5) * chaosAmp * env;
                roy += (hash2(i * 2 + 1, chaosFrame) - 0.5) * chaosAmp * env;
              }
            }
            // Blinker — random on/off; off-probability ramps to 0 toward the back of the band,
            // so each dot flickers as the front passes then settles ON.
            if (cfg.rvBlinkAmt > 0) {
              const pOff = cfg.rvBlinkAmt * (1 - frontCross / crestArea);
              if (pOff > 0.001 && hash2(i * 3 + 7, blinkStep) < pOff) a *= cfg.rvBlinkDim;
            }
            // ASCII decode — pick a glyph: brightness (a) sets the ramp tier, per-dot noise adds
            // variety, and the front-to-back position (settle) blends from a per-frame random
            // scramble → the settled tier so glyphs "decrypt" as the band passes.
            if (asciiOn) {
              const settle = frontCross / crestArea; // 0 at front → 1 at back of band
              let t = (a < 0 ? 0 : a > 1 ? 1 : a) + (d.rand - 0.5) * cfg.rvAsciiVariety;
              if (t < 0) t = 0;
              else if (t > 1) t = 1;
              const scramble = 1 - settle;
              const baseIdx = t * (asciiN - 1);
              const scrIdx = hash2(i * 5 + 3, asciiStep) * (asciiN - 1);
              let idx = Math.round(baseIdx * (1 - scramble) + scrIdx * scramble);
              if (idx < 0) idx = 0;
              else if (idx > asciiN - 1) idx = asciiN - 1;
              glyph = asciiRamp[idx];
              // trailing-edge crossfade: over the last `fadeW` of the band the glyph dissolves
              // into its settled dot (draw both, weighted) instead of hard-swapping at the edge.
              const fadeW = crestArea * cfg.rvAsciiFade;
              if (fadeW > 1e-4) {
                let mx = (frontCross - (crestArea - fadeW)) / fadeW;
                if (mx < 0) mx = 0;
                else if (mx > 1) mx = 1;
                dotMix = mx;
              }
            }
          } else if (cfg.rvSpray > 0 && frontCross <= 0 && frontCross > -0.14) {
            // Spray — a scatter of faint specks flung just ahead of the front (foam)
            const ahead = (frontCross + 0.14) / 0.14; // 0 far ahead → 1 at the front
            if (d.rand < cfg.rvSpray * 0.6) {
              a = cfg.rvSpray * ahead * 0.9;
              m = 0.6; // small speck
              const sp = (1 - ahead) * 26 * cfg.rvSpray; // scatter more further ahead
              rox = Math.cos(d.ph) * sp;
              roy = Math.sin(d.ph) * sp;
            }
          }
        }
      }

      const aa = Math.min(1, a) * d.opacity;
      if (aa < 0.02) continue;
      const px = d.x + d.offX + rox,
        py = d.y + d.offY + roy;
      const s = cfg.size * m * d.size;
      if (glyph) {
        // ASCII crest glyph — cell-sized, so it reads as a character regardless of scale track.
        // Near the back of the band it crossfades into the settled dot (draw both, weighted).
        const gA = aa * (1 - dotMix);
        if (gA > 0.01) {
          ctx.globalAlpha = gA;
          ctx.fillText(glyph, px, py);
        }
        if (dotMix > 0.01 && s >= 0.05) {
          ctx.globalAlpha = aa * dotMix;
          ctx.beginPath();
          this.shapePath(px, py, s);
          ctx.fill();
        }
      } else if (s >= 0.05) {
        ctx.globalAlpha = aa;
        ctx.beginPath();
        this.shapePath(px, py, s);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    this.raf = requestAnimationFrame(this.loop);
  };
}
