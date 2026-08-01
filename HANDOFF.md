# Dotted World Map — Handoff

A React + Vite + TypeScript tool that renders the world map as a field of dots on a
`<canvas>` and plays a **Reveal** — a fully parameterized, load-time animation of the
map appearing. Two views: a **Builder** (the map + a control panel) and a **Site**
(a replica of automattic.com/spaces with the map dropped in).

This doc is the current source of truth. The engine is where all the motion lives; the
panel just drives a plain `Config` object.

---

## Run

```bash
cd "Tools/Doted world map/app"
npm install
npm run dev -- --port 5180   # http://localhost:5180
npm run build                # tsc -b && vite build → dist/  (use this to typecheck)
```

Dev-server launch config also exists as `dotted-world-map` in `.claude/launch.json`.

- **Space** replays the Reveal (works in both views; ignored while typing in a field).
- Bottom-left toggle flips **Builder ⇄ Site**.
- **Copy settings** dumps the current `Config` as clean JSON (schema-exact).
- **Presets** (panel footer): Save current / reload / delete looks (localStorage), or paste a
  settings JSON into the box and **Apply pasted** — for iterating without touching
  `DEFAULT_CONFIG`. (To change the shipped default, still paste into `DEFAULT_CONFIG` in
  `types.ts`.) Paste is sanitized to known `Config` keys, so extra/legacy fields are ignored.
- **● Record reveal** captures the live canvas to a **.webm** (`canvas.captureStream` +
  `MediaRecorder`, VP9→VP8) and downloads it; click again to stop.
- **⟲ Loop: on/off** auto-replays the Reveal on a cadence derived from the current
  speed/delay (`rvDelay + 3200/rvSpeed + 1400ms` pause; recomputes on change). State +
  interval live in `App.tsx`.
- **✦ Surprise me** randomizes only the *expressive* reveal params (pattern, timing, motion,
  edge/crest, both sweep & spotty sets) and replays — dots/color/zoom stay fixed.
  `surprisePatch()` in `App.tsx`.
- **Collapsible sections**: each ①–⑧ header is a clickable `Section` (Panel.tsx) with a
  ▾/▸ caret; globals (zoom/density/size) stay always-visible up top.

---

## The Reveal — control map

The panel groups (`src/components/Panel.tsx`). Color is locked `#0387ff`, bg white,
shape circle.

Every slider's number is **click-to-edit** (`ValueInput` in `controls.tsx`): click to
select it, type an exact value, **Enter or blur commits** (clamped to the slider's min/max,
*not* snapped to step — so you can enter finer values than the slider allows), **Esc cancels**.
Density (grid gap) steps in **0.1** on the slider and accepts arbitrary decimals when typed.

| Group | Controls |
|---|---|
| **Globals** | Canvas zoom · Density (grid gap) · Dot size |
| **① Timing** | **Playhead** (thin `#0387ff` line under the header — fills live with the reveal, resets on replay; `TimingBar` in controls.tsx runs its own rAF reading `mapRef.getProgress()`, a linear 0..1 clock on the engine) · Speed (× — reveal pace, ÷ into `DUR_BASE`) · **Opacity/scale speed** (Connect/Disconnect: link both tracks' Speed to this one) · Start delay · **Sweep easing** (cubic-bézier) · **Opacity/scale easing** (Connect/Disconnect: link both tracks' easing to this curve) |
| **② Reveal pattern** | **Pattern** (Sweep / Spotty) — sets the reveal *order*. Sweep: **Direction** — a rotary **`Dial`** (controls.tsx, drag to set 0–360° snapped to 15°, replaces the old slider) · Stagger · Curve bow. Spotty: **Seed count** (few large ↔ many small patches) · **Spread speed** (× patch growth) · **Edge softness** (soft matte band width) · **Blob** (fBm warp: 0 = circles → organic blobs) · **Blob scale** (noise zoom) · **⟳ Re-roll seeds** |
| **③ Opacity** | Start opacity · **Opacity easing** (cubic-bézier) · Speed (× — snappiness) · Delay (offsets when opacity starts vs the reveal) — *easing & Speed hide when linked to main (① Timing)* |
| **④ Scale** | Start scale · **Scale easing** (cubic-bézier) · Speed (× — snappiness) · Delay (offsets when scale starts vs the reveal) — *easing & Speed hide when linked to main (① Timing)* |
| **⑤ Motion** | Motion in (none/rise/fall/scatter/**directional**) — layers on either pattern · Motion distance *(rise/fall/scatter)* — or **Offset X · Offset Y · Stiffness · Elasticity · Release delay · Delay jitter · Offset spread** *(directional)* · **Motion easing** (cubic-bézier) · Speed (×) · Delay |
| **⑥ Edge effects** | **Edge sharpness** (opacity: crisp↔soft front) · **Edge compression** (position: dots bunch forward at the leading edge) · **Burst strength**/**Burst width** (size+brightness surge on the front) |
| **⑦ Crest** *(hero)* | **Crest style** (Dots / **ASCII decode**) · **Crest area** (band width) · *(ASCII only)* **Glyph set** (01 / 01XO / .:=# / HEX) / **Scramble rate** (Hz) / **Glyph variety** (0 = pure luminance ramp ↔ 1 = noisy) / **Settle fade** (trailing crossfade glyph→dot) · **Chaos** (per-frame jitter → sparkle) · **Spray** (faint foam flung ahead of the front) · **Blinker** — Blink amount / Blink rate (Hz) / Blink dim. All contained to the travelling crest band, both patterns. |
| **⑧ Organic** | Reveal-time jitter · Appearance jitter |

The three **Edge effects** are deliberately split by dimension (opacity / position /
size) so they compose without fighting. All effects fade to 0 at completion so the map
always settles to the exact grid.

**Directional motion** is different from the other three: every dot starts at one uniform
`(Offset X, Offset Y)` — the whole map shifted — and a real per-frame **spring** (integrated
in `loop()`, per-dot state `sox/soy/vx/vy/released/actTime/relDelay`) pulls it home once the
sweep *releases* it. **Stiffness** sets the pull; **Elasticity** sets the overshoot/bounce
(0 = critically damped, 1 = springy). The spring converges to exactly home (verified: it
overshoots then settles to the precise grid). To *see* the whole offset map before it settles,
set Start opacity and Start scale to 1 — otherwise dots are invisible until the sweep activates
them.

Release is gated in two stages: a dot **activates** when its reveal begins (`q > 0`, so
stagger/delay/sweep time this), then its spring **fires** after a per-dot delay. **Release
delay** ramps that delay along the sweep (`introT`, the bow-warped reveal order) so the map
cascades home as a wave *after* fading in; **Delay jitter** adds a random per-dot component for
a scattered settle. **Offset spread** scales each dot's *start* offset along the sweep via
`alongN` (a clean, bow-independent normalized along-sweep coord: `0` at the sweep start → full
offset at the far end) for a parallax/skew feel. All three default to 0 = uniform, instant
release (the original directional behaviour).

**Spotty pattern** replaces the sweep *order* with distance-to-seed. `assignSpotty()` scatters
`Seed count` seeds (seeded `mulberry32(rvSpotSeed)` PRNG, so **Re-roll** — which bumps `rvSpotSeed`
— is reproducible) among the land dots, then sets each dot's `introT`/`alongN` to its normalized
distance to the *nearest* seed (0 at a seed, 1 = farthest). In `loop()`, a soft **front** grows
over its own clock (`Spread speed` ×'s the pace): `front = P·(1+edge)`, and each dot reveals via
`smoothstep((front − introT)/edge)` → the soft, matte, distance-based fade at each patch's growing
edge. Nearest-seed means patches meet at the midlines and fill; `front` reaching `1+edge` at
completion guarantees the last dots finish. Any **Motion** layers on top (it reads the spotty
front for its progress + release). Verified: patches grow from the seeds, meet, and fill.

**Blob** warps the fronts organic: `assignSpotty()` adds `Blob × 600px × fBm(pos·BlobScale)` to
each dot's seed-distance before normalizing, so the circular iso-contours become fractal blobs
(fBm = 4-octave value noise; the seed offsets the field so Re-roll reshapes it too). **Multiplier**
(⑥) is a density thinner for either pattern: a dot stays hidden until the front has passed it by
`rand × Multiplier` (over a fixed ~0.35 band, *decoupled* from Edge softness so it thins genuinely-
visible dots), giving a sparse granular leading edge that fills solid behind. Both default off-ish
(Multiplier 0; Blob 0.35 so Spotty is organic out of the box) and settle to the full grid.

**Crest** (⑦) is the hero: a band of width `Crest area` that travels with the reveal front and
carries the pzazz. Its front (`crestFront`) is **uncapped** — `frontUncapped()` eases to 1 then
continues linearly — so the band moves off the map after completion and the grid settles clean.
Per dot, `frontCross = crestFront − introT·crestIntroMul` (the mul aligns the band to where dots
actually appear: `1` for spotty, `stagger·(1−winO)` for sweep); inside `[0, area]`: **Chaos** (per-frame `hash2`
position jitter over a trapezoid envelope → sparkle) and **Blinker** (`hash2(i, blinkStep) <
Blink amount × (1 − frontCross/area)` → dim by Blink dim; off-probability ramps to 0 toward the
back so each dot flickers then **settles ON**). For dots *just ahead* of the front (`frontCross ∈
[−0.14, 0]`), **Spray** shows a random fraction as faint scattered specks (foam). All default 0
(off).

**ASCII decode** (Crest style = `ascii`) reuses that same band: in-band dots draw as a monospace
glyph via `fillText` instead of the dot shape (behind the band → dots again, so it's a "decode
sweep"). The glyph = a **luminance ramp × brightness** tier + per-dot **variety** noise, blended
from a per-frame random scramble (`hash2(i, asciiStep)`) at the front → the settled tier at the
back (`scramble = 1 − frontCross/area`). Glyphs are sized to the cell (`gap·1.5`), independent of
the scale track, so they read as characters immediately; `aa` alpha still drives the fade-in.
Over the last `Settle fade × area` of the band the glyph **crossfades into its settled dot**
(`dotMix` ramps 0→1; both are drawn, weighted) so the trailing edge dissolves instead of
hard-swapping. Cheap — only in-band dots use `fillText`. Chaos/Blink/Spray still compose on top. *(Removed:
**Glow** — per-dot `ctx.shadowBlur` was too slow and broke the browser; and the earlier
**Multiplier** density idea — a fixed grid can't gain dots without a denser sub-grid.)*

Easings are edited with the draggable **BezierEditor** (`[x1,y1,x2,y2]`, y may overshoot
past 0/1). Presets set common curves.

### Current default look
**Sweep** pattern, 0° (top→bottom), Speed 0.6, curve bow −1.3, directional motion (offset
−40/−40, stiffness 0, elasticity 0.13, spread 1), start opacity 0 / scale grows in, edge
compression 0.4, burst (1.0 / 0.5), **Crest Blinker** on (area 0.22, amount 0.56, rate 11 Hz,
dim 0.25), reveal-time jitter 0.06, density gap 6, dot size 1.3. *(Spotty controls persist for
when you switch patterns: 12 seeds, spread 0.85, edge 0.41, blob 0.2 / scale 3.9.)*

---

## Architecture

**The canvas engine is framework-agnostic.** `DotFieldEngine` takes a `<canvas>` + a
`Config` snapshot and owns all runtime/derived state (mask, dots). React owns `Config`
as the single source of truth, renders the panel, and feeds the engine via
`setConfig()` (which diffs and rebuilds only what changed). `MapCanvas` wraps the engine
lifecycle and is reused by both views; it exposes `replayIntro()` via a ref.

### How the Reveal works (engine)
1. **Per-dot base state.** Every dot carries `offX/offY` (0 = pinned exactly at home),
   `size`, `opacity`. Render = `home + offset`, `cfg.size × dot.size`,
   `alpha × dot.opacity`. A dot with offset 0 renders bit-exact at home — this is the
   foundation that makes "settles to the exact grid" guaranteed.
2. **`assignOrder()`** (runs on pattern / angle / curve-bow / seed / grid change) precomputes
   each dot's reveal **order** `introT` ∈ [0,1]. Sweep → `assignReveal()` (project onto the
   sweep direction, fold in curve bow, renormalize). Spotty → `assignSpotty()` (normalized
   distance to nearest seed). `alongN` mirrors the order for directional parallax.
3. **`revealProgress(now)`** → global progress `Pe` ∈ [0,1], time-based (wall-clock, so
   it's frame-rate independent), shaped by the sweep bézier and `Speed ÷ DUR_BASE` (the reveal
   length is the fixed `DUR_BASE`; Speed is the only pace knob). Opacity/scale can **link** to
   this Speed / sweep curve (`rvSpeedLink` / `rvEaseLink`) or run on their own.
4. Per frame, per dot there are **three tracks** — opacity, scale, motion — all on the global
   clock, but opacity and scale each offset by their own **Delay**: `revealProgressOn(now,
   rvDur, rvSpeed, trackDelay)` → `PeO` / `PeS` (motion uses `Pe`, delay 0); all share the
   sweep bézier `rvEase`. Opacity/scale get their **per-dot window** from a single **Speed**
   (`WIN_BASE ÷ speed`) — motion now uses the same single-Speed shape (`WIN_BASE ÷
   rvMotionSpeed`) plus its own `rvMotionDelay`. Then `q = (Pe_track − order·stagger·(1−win)) /
   win`, `e = ease(q, trackEase)`. Opacity `eO` → `a` (+ appearance jitter, + edge sharpness);
   scale `eS` → `m` (+ appearance jitter); motion `eM` drives rise/fall/scatter and gates the
   directional spring release. Burst + edge compression are **sweep-only**. (This is the *Sweep*
   path; *Spotty* takes a separate branch — the soft front — described above.)

### Files
```
src/
  engine/
    types.ts            Config interface + DEFAULT_CONFIG  ← the shape + the default look
    easing.ts           cubicBezier / ease / EASE_PRESETS  (shared by engine + editor)
    DotFieldEngine.ts   the renderer: mask → dots (chamfer edge dist), assignOrder
                        (assignReveal / assignSpotty), revealProgress, per-frame loop()
  components/
    controls.tsx        Slider / Segmented primitives
    BezierEditor.tsx    draggable cubic-bézier editor (SVG handles + presets + readout)
    Panel.tsx           the whole control panel (grouped)
    PresetBar.tsx       save/load/delete presets (localStorage) + paste-settings-JSON
    MapCanvas.tsx       engine lifecycle wrapper; forwardRef → replayIntro() / getCanvas()
    ViewToggle.tsx      fixed Builder/Site toggle
  site/
    SpacesPage.tsx      automattic.com/spaces replica with the map + 2 city markers
    spaces.css          Spaces page styles (Source Serif Pro, 920px column)
  App.tsx               Config state, view state, Space-to-replay, both views
  index.css             panel + builder layout styles
public/
  map.svg               world silhouette (opaque = land; mask reads the alpha channel)
  automattic-logo.svg, favicon.svg, spaces/*.png
```

---

## Verifying motion (important)

**The in-app Browser pane throttles `requestAnimationFrame` when it isn't the focused
surface** (and often reports "hidden/unresponsive"), so it is unreliable for watching
time-based animation. Use **Playwright** headless instead — it renders at real fps.

- Package is installed in `app/` (`npm i -D playwright`). Chromium is cached at
  `~/Library/Caches/ms-playwright/chromium_headless_shell-1228/.../chrome-headless-shell`
  — pass it as `executablePath` (version-pinned; **don't** run `npx playwright install`).
- Run capture scripts with `NODE_PATH="$(pwd)/node_modules"`.
- Use `deviceScaleFactor: 2` to match a retina display (see DPR gotcha).
- Pattern: `goto` → wait → set sliders via native value setter + `input` event → press
  Space → screenshot at target timestamps. (Scratch scripts from this session:
  `capreveal.js`, `capedge.js`, `measure.js`, etc., under the session scratchpad.)

---

## Gotchas

- **DPR / sharpness.** Internal canvas is fixed at **W = 1800**; it's CSS-scaled down. On a
  **DPR-1** display that downscale can create a faint moiré. A `devicePixelRatio` backing + pixel-
  snap was tried three times and **reverted each time** — the user finds the snapped dots "weird".
  Leave the dot rendering as-is (logical-space arc fill); do not re-attempt without a clear ask.
- **StrictMode** mounts each `MapCanvas` twice; only the live engine draws, the throwaway
  is `destroy()`ed. Expected, not a leak.
- **Config is now lean.** The old inert experiment fields (assemble, noise, scan, ripple,
  impact-curve, edge modes, radial wave…) and `curve.ts`/`noise.ts` were pruned — `Config`
  holds only live reveal fields, so **Copy settings** is now readable.
- **Reveal pattern vs Motion are independent axes.** ② Pattern (Sweep/Spotty) sets the reveal
  *order*; ⑤ Motion (none/rise/fall/scatter/directional) sets how dots *move*. They compose —
  e.g. Spotty order + directional spring. Sweep-only effects (burst, edge compression) are
  skipped in Spotty; ② Sweep controls only render under the Sweep pattern.

---

## Possible next steps

- ~~Render at `devicePixelRatio` for non-retina sharpness.~~ **Do not** — tried & reverted
  3× ("looks weird"); leave the dot rendering as-is (see `dotted-map-no-dpr-snap` memory).
- ~~Loop / auto-replay toggle~~ — done (⟲ Loop button).
- Keep tuning the Reveal feel; add more patterns/effects as new, cleanly-scoped controls.

The persistent project memory (`dotted-world-map.md` in the Claude memory dir) has the
blow-by-blow history — including two dead ends on the along-sweep motion (a sine
"ripple" and a per-dot "elastic compression"), both replaced by the current **Edge
effects**. Worth a skim before reworking that area so the misreads don't repeat.
