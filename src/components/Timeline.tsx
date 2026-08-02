// Timeline view — a docked motion-editor strip under the map. A real-time (seconds) axis:
//  • Master "Reveal" lane: block LEFT = global start delay (rvDelay), WIDTH = reveal duration
//    (DUR_BASE / rvSpeed). Drag body → rvDelay, drag right edge → rvSpeed. Shows the sweep easing.
//  • Opacity / Scale / Motion lanes: block starts at (rvDelay + track delay), WIDTH = per-dot
//    window (WIN_BASE / track speed × reveal duration), with the track's own easing drawn inside.
//    Drag body → track delay, drag right edge → track speed.
//  • Crest lane: the band travels with the front; drag horizontally → rvCrestArea.
// The red playhead reflects the real reveal via getProgress(); the map itself is the live preview.

import { useEffect, useRef } from "react";
import type { Bezier } from "../engine/easing";
import type { Config } from "../engine/types";

const DUR_BASE = 3200; // must match DotFieldEngine
const WIN_BASE = 0.65;
const AXIS = 8000; // timeline width in ms (covers the common speed/delay range)
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const frac = (ms: number) => clamp(ms / AXIS, 0, 1);
const curvePath = (bz: Bezier) => `M0,100 C ${bz[0] * 100},${100 - bz[1] * 100} ${bz[2] * 100},${100 - bz[3] * 100} 100,0`;

type DelayKey = "rvOpacDelay" | "rvScaleDelay" | "rvMotionDelay";
type SpeedKey = "rvOpacSpeed" | "rvScaleSpeed" | "rvMotionSpeed";
type EaseKey = "rvOpacEase" | "rvScaleEase" | "rvMotionEase";
interface Track {
  id: string;
  name: string;
  hue: string;
  delayKey: DelayKey;
  speedKey: SpeedKey;
  easeKey: EaseKey;
}
const TRACKS: Track[] = [
  { id: "opacity", name: "Opacity", hue: "#3B82F6", delayKey: "rvOpacDelay", speedKey: "rvOpacSpeed", easeKey: "rvOpacEase" },
  { id: "scale", name: "Scale", hue: "#14B8A6", delayKey: "rvScaleDelay", speedKey: "rvScaleSpeed", easeKey: "rvScaleEase" },
  { id: "motion", name: "Motion", hue: "#F59E0B", delayKey: "rvMotionDelay", speedKey: "rvMotionSpeed", easeKey: "rvMotionEase" },
];
const CREST_HUE = "#8B5CF6";
const MASTER_HUE = "#414141";

type Drag =
  | { kind: "master"; resize: boolean; tw: number; startX: number; d0: number; w0: number }
  | { kind: "track"; t: Track; resize: boolean; tw: number; startX: number; d0: number; w0: number; revealMs0: number };

export function Timeline({
  cfg,
  update,
  getProgress,
  onReplay,
  onClose,
}: {
  cfg: Config;
  update: (p: Partial<Config>) => void;
  getProgress: () => number;
  onReplay: () => void;
  onClose: () => void;
}) {
  const revealMs = DUR_BASE / Math.max(0.25, cfg.rvSpeed);
  const easeFor = (t: Track): Bezier => (t.id !== "motion" && cfg.rvEaseLink ? cfg.rvEase : cfg[t.easeKey]);

  // live playhead + crest band (reads the real reveal each frame; no React churn)
  const playRef = useRef<HTMLDivElement>(null);
  const crestRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef({ delay: cfg.rvDelay, revealMs, area: cfg.rvCrestArea });
  liveRef.current = { delay: cfg.rvDelay, revealMs, area: cfg.rvCrestArea };
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const { delay, revealMs: rm, area } = liveRef.current;
      const p = clamp(getProgress(), 0, 1);
      const frontMs = delay + p * rm;
      if (playRef.current) playRef.current.style.left = frac(frontMs) * 100 + "%";
      if (crestRef.current) {
        const leftMs = Math.max(delay, frontMs - area * rm);
        crestRef.current.style.left = frac(leftMs) * 100 + "%";
        crestRef.current.style.width = (frac(frontMs) - frac(leftMs)) * 100 + "%";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getProgress]);

  // ---- block dragging (master + tracks) ----
  const drag = useRef<Drag | null>(null);
  type Spec =
    | { kind: "master"; resize: boolean; d0: number; w0: number }
    | { kind: "track"; t: Track; resize: boolean; d0: number; w0: number };
  const startDrag = (e: React.PointerEvent, spec: Spec) => {
    const trackEl = (e.currentTarget as HTMLElement).closest(".tl2-track") as HTMLElement;
    drag.current = { ...spec, tw: trackEl.getBoundingClientRect().width, startX: e.clientX, revealMs0: revealMs } as Drag;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / d.tw;
    if (d.kind === "master") {
      if (d.resize) update({ rvSpeed: Math.round(clamp(DUR_BASE / clamp((d.w0 + dx) * AXIS, 400, AXIS), 0.25, 4) * 20) / 20 });
      else update({ rvDelay: Math.round(clamp((d.d0 + dx) * AXIS, 0, 2000) / 50) * 50 });
    } else {
      if (d.resize) {
        const winMs = clamp((d.w0 + dx) * AXIS, 60, AXIS);
        update({ [d.t.speedKey]: Math.round(clamp((WIN_BASE * d.revealMs0) / winMs, 0.25, 4) * 20) / 20 });
      } else {
        update({ [d.t.delayKey]: Math.round(clamp((d.d0 + dx) * AXIS - cfg.rvDelay, 0, 2000) / 50) * 50 });
      }
    }
  };
  const onUp = () => (drag.current = null);

  // ---- crest sizing ----
  const crestDrag = useRef<null | { tw: number; startX: number; a0: number }>(null);
  const onCrestDown = (e: React.PointerEvent) => {
    crestDrag.current = { tw: (e.currentTarget as HTMLElement).getBoundingClientRect().width, startX: e.clientX, a0: cfg.rvCrestArea };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onCrestMove = (e: React.PointerEvent) => {
    const c = crestDrag.current;
    if (!c) return;
    const dArea = ((e.clientX - c.startX) / c.tw) * AXIS / revealMs;
    update({ rvCrestArea: Math.round(clamp(c.a0 + dArea, 0.05, 0.6) * 100) / 100 });
  };
  const onCrestUp = () => (crestDrag.current = null);

  const mLeft = frac(cfg.rvDelay);
  const mWidth = clamp(revealMs / AXIS, 0.02, 1 - mLeft);

  return (
    <div className="tl2">
      <div className="tl2-head">
        <span className="tl2-title">Timeline</span>
        <span className="tl2-hint">block = when · width = how long · drag right edge = speed</span>
        <button className="tl2-btn" onClick={onReplay} title="Replay">▶ Play</button>
        <button className="tl2-close" onClick={onClose} aria-label="Close timeline">×</button>
      </div>
      <div className="tl2-ruler">
        <div className="tl2-gutter-sp" />
        <div className="tl2-ticks">
          {[0, 2, 4, 6, 8].map((s) => (
            <span key={s} style={{ left: frac(s * 1000) * 100 + "%" }}>{s === 0 ? "0" : s + "s"}</span>
          ))}
        </div>
      </div>
      <div className="tl2-lanes">
        <div className="tl2-gutter">
          <div className="tl2-lab tl2-lab-master"><i style={{ background: MASTER_HUE }} />Reveal</div>
          {TRACKS.map((t) => (
            <div className="tl2-lab" key={t.id}><i style={{ background: t.hue }} />{t.name}</div>
          ))}
          <div className="tl2-lab"><i style={{ background: CREST_HUE }} />Crest</div>
        </div>
        <div className="tl2-tracks">
          {/* master reveal lane */}
          <div className="tl2-track tl2-track-master">
            <div
              className="tl2-block"
              style={{ left: mLeft * 100 + "%", width: mWidth * 100 + "%", background: MASTER_HUE + "1F", borderColor: MASTER_HUE + "99" }}
              onPointerDown={(e) => startDrag(e, { kind: "master", resize: false, d0: mLeft, w0: mWidth })}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <svg className="tl2-curve" viewBox="0 0 100 100" preserveAspectRatio="none"><path d={curvePath(cfg.rvEase)} stroke={MASTER_HUE} /></svg>
              <span className="tl2-bl-lab" style={{ color: MASTER_HUE }}>{(revealMs / 1000).toFixed(1)}s · {cfg.rvSpeed.toFixed(2)}×</span>
              <span className="tl2-grip" style={{ color: MASTER_HUE }} onPointerDown={(e) => startDrag(e, { kind: "master", resize: true, d0: mLeft, w0: mWidth })} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
            </div>
          </div>
          {/* track lanes */}
          {TRACKS.map((t) => {
            const left = frac(cfg.rvDelay + cfg[t.delayKey]);
            const width = clamp(((WIN_BASE / cfg[t.speedKey]) * revealMs) / AXIS, 0.015, 1 - left);
            return (
              <div className="tl2-track" key={t.id}>
                <div
                  className="tl2-block"
                  style={{ left: left * 100 + "%", width: width * 100 + "%", background: t.hue + "22", borderColor: t.hue + "88" }}
                  onPointerDown={(e) => startDrag(e, { kind: "track", t, resize: false, d0: left, w0: width })}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                >
                  <svg className="tl2-curve" viewBox="0 0 100 100" preserveAspectRatio="none"><path d={curvePath(easeFor(t))} stroke={t.hue} /></svg>
                  <span className="tl2-bl-lab" style={{ color: t.hue }}>{cfg[t.delayKey]}ms · {cfg[t.speedKey].toFixed(2)}×</span>
                  <span className="tl2-grip" style={{ color: t.hue }} onPointerDown={(e) => startDrag(e, { kind: "track", t, resize: true, d0: left, w0: width })} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
                </div>
              </div>
            );
          })}
          {/* crest lane */}
          <div className="tl2-track tl2-crestlane" onPointerDown={onCrestDown} onPointerMove={onCrestMove} onPointerUp={onCrestUp} onPointerCancel={onCrestUp}>
            <div className="tl2-crestband" ref={crestRef} style={{ background: CREST_HUE + "33", borderColor: CREST_HUE }} />
            <span className="tl2-crest-lab">{cfg.rvCrestArea.toFixed(2)} · drag to size</span>
          </div>
          <div className="tl2-playhead" ref={playRef} />
        </div>
      </div>
    </div>
  );
}
