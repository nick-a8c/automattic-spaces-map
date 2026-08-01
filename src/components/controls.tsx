// Small reusable panel controls, styled by index.css (.group / .seg ...).

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

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
