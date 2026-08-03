// Pixel replica of the Automattic Spaces page (from website.pdf). Our dotted map
// replaces the map slot; photos are the real ones extracted from the PDF.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Ref } from "react";
import type { Config } from "../engine/types";
import { MapCanvas, type MapHandle } from "../components/MapCanvas";
import { Slider } from "../components/controls";
import "./spaces.css";

// public/ assets resolve from the deploy base (e.g. /automattic-spaces-map/) — not root
const BASE = import.meta.env.BASE_URL;

// How the two city markers animate in. Both markers share these; Stagger spaces them out.
export interface MarkerAnim {
  op0: number; // start opacity (fade from)
  sc0: number; // start scale (grow from)
  offX: number; // start offset X (slide from), px
  offY: number; // start offset Y (slide from), px
  delay: number; // delay before the first marker appears, ms
  dur: number; // per-marker duration, ms
  stagger: number; // gap between the two markers, ms
}
export const DEFAULT_MARKER_ANIM: MarkerAnim = {
  op0: 0,
  sc0: 0.4,
  offX: 0,
  offY: 16,
  delay: 1000,
  dur: 600,
  stagger: 260,
};

interface Marker {
  name: string;
  dotX: number; // px from map's left edge (map is 920px wide)
  dotY: number; // px from map's top edge (map is 460px tall)
  label: "above-right" | "below-left";
}

// Positions per the design spec (map is 920×460).
// SF: square 80/140, label above it, right edge aligned to the square's right side.
// NYC: square 200/116, label under it, left edge aligned to the square's left side.
const MAP_W = 920;
const MAP_H = 460;
const MARKERS: Marker[] = [
  { name: "Mission, SF", dotX: 80, dotY: 140, label: "above-right" },
  { name: "NoHo, NYC", dotX: 200, dotY: 116, label: "below-left" },
];

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

export function SpacesPage({
  cfg,
  mapRef,
  anim,
  setAnim,
  onReplayMap,
}: {
  cfg: Config;
  mapRef?: Ref<MapHandle>;
  anim: MarkerAnim;
  setAnim: (a: MarkerAnim) => void;
  onReplayMap: () => void;
}) {
  const [open, setOpen] = useState(true);
  const markerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animRef = useRef(anim);
  animRef.current = anim;
  const startRef = useRef(0);
  const rafRef = useRef(0);

  // Apply each marker's animated opacity/transform for the given clock time. Returns true when
  // every marker has settled. Styles are set imperatively so React re-renders (slider tweaks)
  // don't clobber the in-flight animation — the JSX only owns left/top.
  const draw = (now: number): boolean => {
    const a = animRef.current;
    const elapsed = now - startRef.current;
    let done = true;
    markerRefs.current.forEach((el, i) => {
      if (!el) return;
      const start = a.delay + i * a.stagger;
      let p = (elapsed - start) / Math.max(1, a.dur);
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      if (p < 1) done = false;
      const e = easeOut(p);
      el.style.opacity = String(a.op0 + (1 - a.op0) * e);
      el.style.transform = `translate(${a.offX * (1 - e)}px, ${a.offY * (1 - e)}px) scale(${a.sc0 + (1 - a.sc0) * e})`;
    });
    return done;
  };

  const play = useCallback(() => {
    startRef.current = performance.now();
    cancelAnimationFrame(rafRef.current);
    draw(startRef.current); // paint the hidden start state synchronously (no flash)
    const loop = (t: number) => {
      if (!draw(t)) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run the marker animation on mount and whenever a setting changes (live preview).
  useLayoutEffect(() => {
    play();
    return () => cancelAnimationFrame(rafRef.current);
  }, [anim, play]);

  // Space replays the markers (App's global handler replays the map, so they stay in sync).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "TEXTAREA" || el?.isContentEditable) return;
      if (tag === "INPUT" && (el as HTMLInputElement).type !== "range") return;
      play();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play]);

  const set = (patch: Partial<MarkerAnim>) => setAnim({ ...anim, ...patch });
  const secs = (v: number) => (v / 1000).toFixed(2) + "s";

  return (
    <div className="site-page">
      <div className="site-inner">
        <div className="site-toprule" />
        <header className="site-header">
          <img className="site-logo" src={`${BASE}automattic-logo.svg`} alt="Automattic" />
          <nav className="site-nav">
            <a href="#">
              <span className="num">1.</span> Home
            </a>
            <a href="#">
              <span className="num">2.</span> About Us
            </a>
            <a href="#">
              <span className="num">3.</span> News
            </a>
            <a href="#">
              <span className="num">4.</span> Work With Us
            </a>
          </nav>
        </header>

        <h1 className="site-h1">Distributed, not remote</h1>
        <p className="site-lede">
          Work where it works for you. Turn Slack handles into actual conversations with
          Automatticians and friends—in spaces designed for coworking, events, and meetups.
        </p>

        {/* reserved map slot — our dotted map */}
        <div className="map-slot">
          <div className="map-inner">
            <MapCanvas ref={mapRef} cfg={cfg} className="map-slot-canvas" />
            {MARKERS.map((m, i) => (
              <div
                key={m.name}
                ref={(el) => {
                  markerRefs.current[i] = el;
                }}
                className={`site-marker mk-${m.label}`}
                style={{
                  left: `${(m.dotX / MAP_W) * 100}%`,
                  top: `${(m.dotY / MAP_H) * 100}%`,
                }}
              >
                <span className="site-marker-dot" />
                <span className="site-marker-label">{m.name}</span>
              </div>
            ))}
          </div>
        </div>

        <section className="two-col intro-row">
          <h2 className="site-h2">
            Two places
            <br />
            to connect
          </h2>
          <p className="site-body">
            Two spaces, open 24/7, designed for Automatticians, by Automatticians. Drop by, plug in,
            and slide seamlessly into your next project with everything you need to share our culture
            with friends, get productive, and elevate your work.
          </p>
        </section>

        <hr className="site-divider" />

        <section className="two-col noho-row">
          <div>
            <h2 className="site-h2">NoHo Space</h2>
            <p className="site-address">
              166 Crosby St.
              <br />
              New York, NY 10012 <a href="#">(map)</a>
            </p>
          </div>
          <div>
            <p className="site-body">
              Come visit our space in New York City. Check out our events, workshops, meetups, and
              gatherings for the WordPress community and anyone building on the open web.
            </p>
            <p className="site-body">
              From chatting about the <a href="#">future of the web</a> to{" "}
              <a href="#">art discussions</a>, we host all kinds of meetups, workshops, talks, and
              collaborations. If you’d like to visit the space or learn more, reach out.
            </p>
            <div className="pill-row">
              <a className="pill pill-filled" href="#">
                See what’s happening at NoHo
              </a>
              <a className="pill pill-outline" href="#">
                Get in touch
              </a>
            </div>
          </div>
        </section>

        <div className="photo-row row-a">
          <img src={`${BASE}spaces/noho-interior.png`} alt="NoHo Space" />
          <img src={`${BASE}spaces/noho-gallery.png`} alt="NoHo Space" />
        </div>
        <div className="photo-row row-b">
          <img src={`${BASE}spaces/noho-event.png`} alt="NoHo Space" />
          <img src={`${BASE}spaces/noho-cafe.png`} alt="NoHo Space" />
        </div>

        <div className="vtour">
          <img src={`${BASE}spaces/noho-tour.png`} alt="NoHo Space virtual tour" />
          <a className="pill pill-white vtour-pill" href="#">
            Take a virtual tour <span className="arrow">↗</span>
          </a>
        </div>
      </div>

      {/* marker-animation controls — floats over the site preview */}
      <div className={open ? "mk-panel" : "mk-panel collapsed"}>
        <button className="mk-panel-head" onClick={() => setOpen((o) => !o)}>
          <span>Marker animation</span>
          <span className="mk-chev">{open ? "▾" : "▸"}</span>
        </button>
        {open && (
          <div className="mk-panel-body">
            <Slider label="Start opacity" min={0} max={1} step={0.05} value={anim.op0} onChange={(v) => set({ op0: v })} format={(v) => v.toFixed(2)} />
            <Slider label="Start scale" min={0} max={2} step={0.05} value={anim.sc0} onChange={(v) => set({ sc0: v })} format={(v) => v.toFixed(2)} />
            <Slider label="Offset X" min={-60} max={60} step={1} value={anim.offX} onChange={(v) => set({ offX: v })} format={(v) => v + "px"} />
            <Slider label="Offset Y" min={-60} max={60} step={1} value={anim.offY} onChange={(v) => set({ offY: v })} format={(v) => v + "px"} />
            <Slider label="Delay" min={0} max={3000} step={50} value={anim.delay} onChange={(v) => set({ delay: v })} format={secs} />
            <Slider label="Duration" min={100} max={2000} step={50} value={anim.dur} onChange={(v) => set({ dur: v })} format={secs} />
            <Slider label="Stagger" min={0} max={1000} step={20} value={anim.stagger} onChange={(v) => set({ stagger: v })} format={(v) => v + "ms"} />
            <button className="btn primary" onClick={() => { play(); onReplayMap(); }}>
              ↻ Replay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
