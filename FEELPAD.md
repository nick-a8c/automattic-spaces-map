# Feel Pad — portable component handoff

A one-gesture control: **drag a single dot around a 2-D square to set two motion qualities at
once.** Each axis maps to a *feel* (pace, texture) rather than a raw number, so you find a vibe
fast, then fine-tune with sliders. Built for the Dotted World Map, but the pad itself is
tool-agnostic — only the axis→param **mapping** is specific to a given tool.

Live in-context: https://nick-a8c.github.io/automattic-spaces-map/ → **Builder** view → **◐ Feel**.

---

## The idea (read this first)

The pad is a dumb 2-D input. It owns nothing. It does exactly three things:

1. **Reads back** a dot position from two of *your* live params (one per axis) so the dot always
   reflects the real state.
2. On drag, **maps** the cursor's normalized `(nx, ny)` ∈ [0,1]² to a patch of *your* params and
   calls `onChange(patch)`.
3. On release, calls an optional `onRelease()` (we use it to replay/preview).

Everything tool-specific lives in one function: the mapping. Swap the param names and ranges and
it drops into any tool. The dot-position read-back is the only reason the pad needs to know two
of your params by value.

**Design choices worth keeping:**

- **One axis = one *quality*, not one param.** Our Y ("Rigid ↔ Smooth") writes *three* params at
  once (elasticity, jitter, edge-softness). That's the whole point — a feel is a chord, not a
  note. X ("Slow ↔ Fast") happens to be a single param (speed); that's fine too.
- **Read-back uses the two "hero" params only.** You can't invert a 3-param blend back to one Y
  coordinate, so pick the single most-representative param per axis for the dot's resting spot
  (we use `speed` for X, `elasticity` for Y). The secondary params are write-only.
- **Release-to-preview**, not drag-to-preview. Restarting an animation every pointermove is janky;
  firing once on release feels deliberate.
- **Writes real params.** The pad is not a separate mode — it moves the same sliders. So the user
  can start on the pad and finish on a slider, or vice-versa, with no reconciliation.

**Our mapping (for reference):**

| Axis | Direction | Param(s) written | Range |
|------|-----------|------------------|-------|
| X | Slow → Fast | `rvSpeed` | 0.4 → 1.7 |
| Y | Rigid → Smooth | `rvElasticity` | 0 → 0.5 |
| Y | Rigid → Smooth | `rvJitterTime` | 0 → 0.12 |
| Y | Rigid → Smooth | `rvEdgeSharp` | **0.7 → 0** (inverted: rigid = crisp edge) |

Dot read-back: `x = inv(speed, 0.4, 1.7)`, `y = inv(elasticity, 0, 0.5)`.

> **Gotcha:** in our tool the elasticity/overshoot only *shows* when Motion = Directional (that's
> where the spring lives). Jitter + edge respond in every mode, so both axes always do something,
> but pick hero params that are always active in *your* tool if you can.

---

## React / TSX version (canonical — as shipped)

Drop-in component. No deps beyond React. Styling via the CSS block below.

```tsx
// 2-D "feel pad": drag one dot to set the reveal's overall vibe. X = pace, Y = texture.
// One gesture writes several params at once. The dot's resting position is read back from the
// two hero params (speed, elasticity); releasing fires onRelease (we replay the animation).
export function FeelPad({
  speed,
  elasticity,
  onChange,
  onRelease,
}: {
  speed: number;
  elasticity: number;
  onChange: (patch: {
    rvSpeed: number;
    rvElasticity: number;
    rvJitterTime: number;
    rvEdgeSharp: number;
  }) => void;
  onRelease?: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // --- the ONLY tool-specific part: axis ranges + which params each axis writes ---
  const SPEED: [number, number] = [0.4, 1.7];
  const ELAS: [number, number] = [0, 0.5];
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const inv = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
  const r2 = (v: number) => Math.round(v * 100) / 100;

  // dot position from the two hero params (px right = faster, py up = smoother)
  const px = inv(speed, SPEED[0], SPEED[1]);
  const py = inv(elasticity, ELAS[0], ELAS[1]);

  const setFrom = (clientX: number, clientY: number) => {
    const el = wrap.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = clamp01((clientX - r.left) / r.width);
    const ny = 1 - clamp01((clientY - r.top) / r.height); // up = smoother
    onChange({
      rvSpeed: r2(lerp(SPEED[0], SPEED[1], nx)),
      rvElasticity: r2(lerp(ELAS[0], ELAS[1], ny)),
      rvJitterTime: r2(lerp(0, 0.12, ny)),
      rvEdgeSharp: r2(lerp(0.7, 0, ny)),
    });
  };

  const end = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onRelease?.();
  };

  return (
    <div className="control feelpad-control">
      <div
        ref={wrap}
        className="feelpad"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setFrom(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => dragging.current && setFrom(e.clientX, e.clientY)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <span className="feelpad-edge fp-top">Smooth</span>
        <span className="feelpad-edge fp-bottom">Rigid</span>
        <span className="feelpad-edge fp-left">Slow</span>
        <span className="feelpad-edge fp-right">Fast</span>
        <div className="feelpad-dot" style={{ left: `${px * 100}%`, top: `${(1 - py) * 100}%` }} />
      </div>
    </div>
  );
}
```

Wiring it into a panel (this tool's `App` owns `cfg` and an `update(patch)` reducer + a
`replayIntro()`):

```tsx
<FeelPad
  speed={cfg.rvSpeed}
  elasticity={cfg.rvElasticity}
  onChange={update}          // (patch) => setCfg(c => ({ ...c, ...patch }))
  onRelease={onReplay}       // () => mapRef.current?.replayIntro()
/>
```

The `onChange` patch keys must exist on your config; `update` merges them. That's the entire
integration surface.

---

## Vanilla JS / HTML version (for single-file canvas tools)

Same behavior, zero framework. Give it a container, a state object, and an `onChange`/`onRelease`.
Adapt the `map()` body — that's your tool's mapping.

```html
<div id="feelpad" class="feelpad">
  <span class="feelpad-edge fp-top">Smooth</span>
  <span class="feelpad-edge fp-bottom">Rigid</span>
  <span class="feelpad-edge fp-left">Slow</span>
  <span class="feelpad-edge fp-right">Fast</span>
  <div class="feelpad-dot"></div>
</div>
```

```js
function makeFeelPad(el, { getHero, map, onChange, onRelease }) {
  const dot = el.querySelector('.feelpad-dot');
  const clamp01 = v => Math.min(1, Math.max(0, v));
  let dragging = false;

  // getHero() -> { px, py } in [0,1], to position the dot from current state
  function sync() {
    const { px, py } = getHero();
    dot.style.left = px * 100 + '%';
    dot.style.top = (1 - py) * 100 + '%';
  }

  function setFrom(clientX, clientY) {
    const r = el.getBoundingClientRect();
    const nx = clamp01((clientX - r.left) / r.width);
    const ny = 1 - clamp01((clientY - r.top) / r.height); // up = smoother
    onChange(map(nx, ny));   // map() returns your patch; caller updates state + calls sync()
  }

  el.addEventListener('pointerdown', e => {
    dragging = true;
    el.setPointerCapture(e.pointerId);
    setFrom(e.clientX, e.clientY);
  });
  el.addEventListener('pointermove', e => dragging && setFrom(e.clientX, e.clientY));
  const end = () => { if (dragging) { dragging = false; onRelease && onRelease(); } };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  sync();
  return { sync };
}

// --- your tool-specific mapping (the only bit that changes per tool) ---
const lerp = (a, b, t) => a + (b - a) * t;
const inv  = (v, a, b) => Math.min(1, Math.max(0, (v - a) / (b - a)));

const pad = makeFeelPad(document.getElementById('feelpad'), {
  getHero: () => ({ px: inv(state.speed, 0.4, 1.7), py: inv(state.elasticity, 0, 0.5) }),
  map: (nx, ny) => ({
    speed:      +lerp(0.4, 1.7, nx).toFixed(2),
    elasticity: +lerp(0,   0.5, ny).toFixed(2),
    jitter:     +lerp(0,  0.12, ny).toFixed(2),
    edgeSharp:  +lerp(0.7,  0,  ny).toFixed(2), // inverted
  }),
  onChange: patch => { Object.assign(state, patch); pad.sync(); /* + redraw / update sliders */ },
  onRelease: () => replay(),
});
```

---

## CSS (shared by both versions)

Uses three CSS variables — `--track-empty` (grid/border), `--label` (text), and a blue accent.
Replace `var(--track-empty)` / `var(--label)` with literals if your tool has no theme vars.

```css
/* 2-D feel pad — drag a dot to set pace (x) × texture (y) */
.feelpad-hint {
  margin: 0 0 10px;
  font-family: "ABeeZee", ui-sans-serif, system-ui, sans-serif;
  font-size: 10px;
  color: var(--label);
  text-align: center;
}
.feelpad-control { display: flex; justify-content: center; }
.feelpad {
  position: relative;
  width: 150px;
  height: 150px;
  border: 1px solid var(--track-empty);
  border-radius: 8px;
  cursor: crosshair;
  touch-action: none;               /* required: stops the page scrolling while you drag */
  background:
    linear-gradient(to right, transparent calc(50% - 0.5px), var(--track-empty) calc(50% - 0.5px), var(--track-empty) calc(50% + 0.5px), transparent calc(50% + 0.5px)),
    linear-gradient(to bottom, transparent calc(50% - 0.5px), var(--track-empty) calc(50% - 0.5px), var(--track-empty) calc(50% + 0.5px), transparent calc(50% + 0.5px));
}
.feelpad-dot {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #0387ff;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transform: translate(-50%, -50%);
  pointer-events: none;             /* so the pointer hits the pad, not the dot */
}
.feelpad-edge {
  position: absolute;
  font-family: "ABeeZee", ui-sans-serif, system-ui, sans-serif;
  font-size: 7px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--label);
  pointer-events: none;
}
.fp-top    { top: 5px;    left: 50%; transform: translateX(-50%); }
.fp-bottom { bottom: 5px; left: 50%; transform: translateX(-50%); }
.fp-left   { left: 6px;   top: 50%;  transform: translateY(-50%); }
.fp-right  { right: 6px;  top: 50%;  transform: translateY(-50%); }
```

---

## Adapting to a new tool — checklist

1. **Pick two axes.** Name them as *qualities* the user cares about (pace, weight, energy,
   softness…), not param names.
2. **Pick the params each axis writes.** One or many per axis. Decide direction (which end is
   which) and a sensible min/max range for each.
3. **Choose one hero param per axis** for the dot read-back — the one that best represents that
   axis and is always active.
4. **Rewrite the mapping** (`map()` / the `onChange` body) and the read-back (`getHero()` / `px,py`).
   Nothing else changes.
5. **Relabel the four edges** (`fp-top/bottom/left/right` text).
6. **Wire `onChange`** to your state update, and `onRelease` to a preview/replay if you have one.
7. Keep `touch-action: none` on the pad and `pointer-events: none` on the dot — both are load-
   bearing.

## Provenance

Extracted from `automattic-spaces-map` (Dotted World Map). Canonical source:
`src/components/controls.tsx` (`FeelPad`), styles in `src/index.css` (`.feelpad*`), wired in
`src/components/Panel.tsx` (◐ Feel section). Verified end-to-end (both corners drive real params;
sliders follow; release replays).
