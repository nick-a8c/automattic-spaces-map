// Full-screen "Looks" gallery: a launcher overlay with a live animated preview per look. Each
// tile loops a stylized grid reveal (recognizable per look, in the panel's own style); picking one
// applies its real reveal bundle to the map + replays + closes. Feel-pad / describe-it come later.

import { useEffect, useRef } from "react";
import { LOOKS, type Look } from "../looks";

const COLS = 30;
const ROWS = 15;
const CHARS = "01X";
const PERIOD = 2900; // loop period (ms)
const REVEAL = 1900; // reveal portion of the loop (ms); the rest is a hold
const WIN = 0.5; // per-dot window

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

interface Cell {
  nx: number;
  ny: number;
  ph: number;
}

function orderFor(id: string, c: Cell, seeds: Cell[]): number {
  if (id === "spring") return Math.hypot(c.nx, c.ny) / 1.4142;
  if (id === "cascade") return c.ny + (c.ph - 0.5) * 0.04;
  if (id === "decode") return c.nx;
  if (id === "bloom") {
    let best = 9;
    for (const s of seeds) best = Math.min(best, Math.hypot(c.nx - s.nx, c.ny - s.ny));
    return best / 0.6;
  }
  if (id === "fade") return 0;
  return c.nx * 0.7 + c.ny * 0.3; // sweep (default)
}

function LookTile({ look, active, onPick }: { look: Look; active: boolean; onPick: () => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const cs = getComputedStyle(document.documentElement);
    const dormant = cs.getPropertyValue("--track-empty").trim() || "#e1e1e1";
    const ink = cs.getPropertyValue("--ink").trim() || "#16171a";
    const accent = "#0387ff";

    const cells: Cell[] = [];
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++) cells.push({ nx: (i + 0.5) / COLS, ny: (j + 0.5) / ROWS, ph: Math.random() });
    const seeds: Cell[] = [];
    for (let s = 0; s < 4; s++) seeds.push(cells[(Math.random() * cells.length) | 0]);
    const ord = cells.map((c) => Math.max(0, Math.min(1, orderFor(look.id, c, seeds))));

    let w = 0, h = 0, r = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => {
      w = cv.clientWidth;
      h = cv.clientHeight || w / 2;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      r = Math.max(1, (w / COLS) * 0.3);
    };
    size();

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const on = activeRef.current;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = Math.round((w / COLS) * 1.05) + "px ui-monospace, monospace";
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        const px = c.nx * w, py = c.ny * h;
        ctx.globalAlpha = 1;
        ctx.fillStyle = dormant;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, 6.283);
        ctx.fill();
        let q = (t - ord[i] * (1 - WIN)) / WIN;
        if (q < 0) q = 0;
        else if (q > 1) q = 1;
        const e = easeOut(q);
        if (e <= 0.02) continue;
        let dx = 0, dy = 0, sc = 1;
        let glyph: string | null = null;
        if (look.id === "spring") { const rem = 1 - e; dx = -c.nx * w * rem * 0.45; dy = -c.ny * h * rem * 0.45; sc = 0.55 + 0.45 * e; }
        else if (look.id === "cascade") { dy = (1 - e) * h * 0.07; sc = 0.6 + 0.4 * e; }
        else if (look.id === "bloom") { sc = 0.4 + 0.6 * e; }
        else if (look.id === "decode") { if (q > 0.04 && q < 0.94) glyph = CHARS[(Math.floor(t * 38 + i * 7)) % CHARS.length]; }
        ctx.globalAlpha = Math.min(1, e);
        ctx.fillStyle = on ? accent : ink;
        if (glyph) ctx.fillText(glyph, px + dx, py + dy);
        else { ctx.beginPath(); ctx.arc(px + dx, py + dy, r * sc, 0, 6.283); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    };

    if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) {
      draw(1);
      return;
    }
    let raf = 0;
    const loop = (now: number) => {
      const local = now % PERIOD;
      draw(local < REVEAL ? local / REVEAL : 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onResize = () => size();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [look.id]);

  return (
    <button className={active ? "look-tile on" : "look-tile"} onClick={onPick} title={look.desc}>
      <span className="look-tick">✓</span>
      <canvas ref={ref} />
      <span className="look-cap">
        <b>{look.name}</b>
        <i>{look.desc}</i>
      </span>
    </button>
  );
}

export function LooksGallery({
  onClose,
  onPick,
  activeId,
}: {
  onClose: () => void;
  onPick: (look: Look) => void;
  activeId: string | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="looks-overlay" onClick={onClose}>
      <div className="looks-modal" onClick={(e) => e.stopPropagation()}>
        <div className="looks-modal-head">
          <div className="looks-modal-title">Looks</div>
          <button className="looks-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="looks-modal-sub">Pick a motion — it applies to your map</div>
        <div className="looks-gal">
          {LOOKS.map((l) => (
            <LookTile key={l.id} look={l} active={activeId === l.id} onPick={() => onPick(l)} />
          ))}
        </div>
      </div>
    </div>
  );
}
