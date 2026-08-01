// Interactive cubic-bézier easing editor: draggable P1/P2 handles over a plotted
// curve, plus quick presets. Value is [x1,y1,x2,y2] (CSS cubic-bezier); y may exceed
// [0,1] for overshoot. Framework-agnostic engine reads the same tuple.

import { useEffect, useRef } from "react";
import type { Bezier } from "../engine/easing";
import { EASE_PRESETS } from "../engine/easing";

const VB_W = 200;
const VB_H = 172;
const L = 24;
const R = 176;
const B = 130; // y for value 0
const SPAN_X = R - L;
const SPAN_Y = 100; // pixels per 1.0 of value
const px = (x: number) => L + x * SPAN_X;
const py = (v: number) => B - v * SPAN_Y;

function samePreset(a: Bezier, b: Bezier) {
  return a.every((n, i) => Math.abs(n - b[i]) < 0.001);
}

export function BezierEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Bezier;
  onChange: (v: Bezier) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<0 | 1 | 2>(0);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  useEffect(() => {
    const toValue = (clientX: number, clientY: number): [number, number] => {
      const r = svgRef.current!.getBoundingClientRect();
      const vx = ((clientX - r.left) / r.width) * VB_W;
      const vy = ((clientY - r.top) / r.height) * VB_H;
      const x = Math.max(0, Math.min(1, (vx - L) / SPAN_X));
      const y = Math.max(-0.4, Math.min(1.4, (B - vy) / SPAN_Y));
      return [x, y];
    };
    const onMove = (e: PointerEvent) => {
      if (!drag.current) return;
      e.preventDefault();
      const [x, y] = toValue(e.clientX, e.clientY);
      const nv = [...latest.current.value] as Bezier;
      if (drag.current === 1) {
        nv[0] = x;
        nv[1] = y;
      } else {
        nv[2] = x;
        nv[3] = y;
      }
      latest.current.onChange(nv);
    };
    const onUp = () => (drag.current = 0);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const [x1, y1, x2, y2] = value;
  const pts: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const v = 1 - u;
    const bx = 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u;
    const by = 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u;
    pts.push(`${px(bx).toFixed(1)},${py(by).toFixed(1)}`);
  }
  const active = EASE_PRESETS.find((p) => samePreset(p.v, value));

  return (
    <div className="bezier">
      <label className="bezier-label">{label}</label>
      <svg
        ref={svgRef}
        className="bezier-plot"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        onPointerDown={(e) => e.preventDefault()}
      >
        {/* frame + value 0/1 guides */}
        <rect x={L} y={py(1)} width={SPAN_X} height={SPAN_Y} className="bz-box" />
        {/* handle stems */}
        <line x1={px(0)} y1={py(0)} x2={px(x1)} y2={py(y1)} className="bz-stem" />
        <line x1={px(1)} y1={py(1)} x2={px(x2)} y2={py(y2)} className="bz-stem" />
        {/* the curve */}
        <polyline points={pts.join(" ")} className="bz-curve" />
        {/* endpoints */}
        <circle cx={px(0)} cy={py(0)} r={2.5} className="bz-anchor" />
        <circle cx={px(1)} cy={py(1)} r={2.5} className="bz-anchor" />
        {/* draggable handles */}
        <circle
          cx={px(x1)}
          cy={py(y1)}
          r={6}
          className="bz-handle"
          onPointerDown={(e) => {
            e.preventDefault();
            drag.current = 1;
          }}
        />
        <circle
          cx={px(x2)}
          cy={py(y2)}
          r={6}
          className="bz-handle"
          onPointerDown={(e) => {
            e.preventDefault();
            drag.current = 2;
          }}
        />
      </svg>
      <div className="bezier-presets">
        {EASE_PRESETS.map((p) => (
          <button
            key={p.name}
            className={active?.name === p.name ? "active" : ""}
            onClick={() => onChange([...p.v] as Bezier)}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="bezier-val">
        cubic-bezier({value.map((n) => n.toFixed(2)).join(", ")})
      </div>
    </div>
  );
}
