// Cubic-bézier easing, framework-agnostic. A curve is [x1, y1, x2, y2] — the two
// control handles of a bézier from (0,0) to (1,1), matching CSS cubic-bezier().
// y may exceed [0,1] for overshoot/anticipation.

export type Bezier = [number, number, number, number];

export interface EasePreset {
  name: string;
  v: Bezier;
}

export const EASE_PRESETS: EasePreset[] = [
  { name: "Linear", v: [0, 0, 1, 1] },
  { name: "Ease", v: [0.25, 0.1, 0.25, 1] },
  { name: "In", v: [0.42, 0, 1, 1] },
  { name: "Out", v: [0, 0, 0.58, 1] },
  { name: "In-out", v: [0.42, 0, 0.58, 1] },
];

/** Evaluate the eased value (y) for input t (x/time), 0..1. */
export function cubicBezier(t: number, x1: number, y1: number, x2: number, y2: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const sampleX = (u: number) => {
    const v = 1 - u;
    return 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u;
  };
  const sampleY = (u: number) => {
    const v = 1 - u;
    return 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u;
  };
  const dX = (u: number) => {
    const v = 1 - u;
    return 3 * v * v * x1 + 6 * v * u * (x2 - x1) + 3 * u * u * (1 - x2);
  };
  // Newton–Raphson to find the bézier parameter u where sampleX(u) = t.
  let u = t;
  for (let i = 0; i < 8; i++) {
    const x = sampleX(u) - t;
    if (Math.abs(x) < 1e-5) break;
    const d = dX(u);
    if (Math.abs(d) < 1e-6) break;
    u -= x / d;
    if (u < 0) u = 0;
    else if (u > 1) u = 1;
  }
  return sampleY(u);
}

export function ease(t: number, b: Bezier): number {
  return cubicBezier(t, b[0], b[1], b[2], b[3]);
}
