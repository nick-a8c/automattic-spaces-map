// Small reusable panel controls, styled by index.css (.group / .seg ...).

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

// Rotary dial for an angle (0..360). Drag around it; snaps to `step`. Reads/writes degrees —
// a circle is more legible for a direction than a linear slider. Styled in .dial (index.css).
export function Dial({
  label,
  value,
  onChange,
  step = 15,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFrom = (clientX: number, clientY: number) => {
    const el = wrap.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let ang = (Math.atan2(clientY - (r.top + r.height / 2), clientX - (r.left + r.width / 2)) * 180) / Math.PI + 90;
    if (ang < 0) ang += 360;
    let v = Math.round(ang / step) * step;
    if (v >= 360) v -= 360;
    onChange(v);
  };

  const R = 26;
  const a = ((value - 90) * Math.PI) / 180;
  const kx = 32 + Math.cos(a) * R;
  const ky = 32 + Math.sin(a) * R;

  return (
    <div className="control dial-control">
      <div
        ref={wrap}
        className="dial"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setFrom(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => dragging.current && setFrom(e.clientX, e.clientY)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <svg viewBox="0 0 64 64" className="dial-svg">
          <circle className="dial-ring" cx={32} cy={32} r={R} />
          <circle
            className="dial-arc"
            cx={32}
            cy={32}
            r={R}
            pathLength={360}
            transform="rotate(-90 32 32)"
            style={{ strokeDasharray: `${value} 360` }}
          />
          <circle className="dial-knob" cx={kx} cy={ky} r={3.5} />
        </svg>
        <div className="dial-hub">
          <b>{value}°</b>
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}

// Live reveal playhead: a thin bar that fills in sync with the actual reveal (resets on replay,
// tracks Speed/Delay). Runs its own rAF and writes width to a ref — no React state churn.
export function TimingBar({ getProgress }: { getProgress: () => number }) {
  const fill = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (fill.current) fill.current.style.width = (getProgress() * 100).toFixed(1) + "%";
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getProgress]);
  return (
    <div className="revbar">
      <div ref={fill} className="revbar-fill" />
    </div>
  );
}

export interface Opt {
  v: string;
  label: string;
}

// Editable readout for a Slider: shows the formatted value, but click/focus to type an
// exact number. Commit on Enter/blur (clamped to [min,max], not snapped to step — so you
// can enter finer values than the slider steps); Escape cancels.
function ValueInput({
  value,
  min,
  max,
  fmt,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  fmt: (v: number) => string;
  onCommit: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const skipCommit = useRef(false); // set by Escape so the ensuing blur cancels instead of commits

  // Select the whole value once the controlled re-render has swapped in the raw draft, so a
  // click selects it and the first keystroke overwrites. useLayoutEffect runs synchronously
  // before paint — no rAF race with fast typing, and unaffected by hidden-tab rAF throttling.
  useLayoutEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  const commit = () => {
    const n = parseFloat(draft);
    if (!Number.isNaN(n)) onCommit(Math.min(max, Math.max(min, n)));
  };

  return (
    <input
      ref={ref}
      className="slider-val"
      type="text"
      inputMode="decimal"
      value={editing ? draft : fmt(value)}
      onFocus={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (skipCommit.current) skipCommit.current = false;
        else commit();
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur(); // blur commits (single commit path)
        } else if (e.key === "Escape") {
          skipCommit.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const fmt = format ?? ((v: number) => String(v));
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="control">
      <div className="slider">
        <label className="slider-label">{label}</label>
        <input
          className="slider-input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          style={{ "--pct": `${pct}%` } as CSSProperties}
        />
        <ValueInput value={value} min={min} max={max} fmt={fmt} onCommit={onChange} />
      </div>
    </div>
  );
}

export function Segmented({
  label,
  rows,
  value,
  onChange,
}: {
  label?: string;
  rows: Opt[][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="group">
      {label && <label>{label}</label>}
      {rows.map((row, ri) => (
        <div
          className="seg"
          key={ri}
          style={ri < rows.length - 1 ? { marginBottom: 6 } : undefined}
        >
          {row.map((o) => (
            <button
              key={o.v}
              className={value === o.v ? "active" : ""}
              onClick={() => onChange(o.v)}
            >
              {o.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
