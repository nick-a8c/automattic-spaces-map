// Control panel. Globals (zoom / density / size) up top, then the Reveal —
// the single, fully parameterized load animation — grouped into five sections.
// Color is locked to #0387ff, background white, shape circle.

import { useState, type ReactNode } from "react";
import type { Config } from "../engine/types";
import type { Bezier } from "../engine/easing";
import { Dial, Segmented, Slider, TimingBar, type Opt } from "./controls";
import { BezierEditor } from "./BezierEditor";
import { PresetBar } from "./PresetBar";

const MOTION: Opt[][] = [
  [
    { v: "none", label: "None" },
    { v: "rise", label: "Rise" },
  ],
  [
    { v: "fall", label: "Fall" },
    { v: "scatter", label: "Scatter" },
  ],
  [{ v: "directional", label: "Directional" }],
];

// Reveal pattern: directional Sweep vs Spotty (patches grow from seeds).
const PATTERN: Opt[][] = [
  [
    { v: "sweep", label: "Sweep" },
    { v: "spotty", label: "Spotty" },
  ],
];

// Connect/Disconnect toggle for linking opacity+scale to the main Speed / easing.
const LINK: Opt[][] = [
  [
    { v: "connect", label: "Connect" },
    { v: "disconnect", label: "Disconnect" },
  ],
];

// Crest render: normal dots vs the ASCII decode sweep.
const CREST_STYLE: Opt[][] = [
  [
    { v: "dots", label: "Dots" },
    { v: "ascii", label: "ASCII decode" },
  ],
];

// Preset glyph ramps for ASCII decode (ordered light→heavy — brightness picks the tier).
const GLYPHS: Opt[][] = [
  [
    { v: "01", label: "01" },
    { v: "01XO", label: "01XO" },
    { v: ".:-=+*#", label: ".:=#" },
    { v: "0123456789ABCDEF", label: "HEX" },
  ],
];

// A reveal section with a clickable header that collapses its controls.
function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <hr className="section" />
      <button className="rev-head rev-head-btn" onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <span className="rev-caret">{open ? "▾" : "▸"}</span>
      </button>
      {open && children}
    </>
  );
}

export interface PanelProps {
  cfg: Config;
  update: (patch: Partial<Config>) => void;
  onReplay: () => void;
  onRecord: () => void;
  recording: boolean;
  onSurprise: () => void;
  loop: boolean;
  onToggleLoop: () => void;
  getProgress: () => number;
}

export function Panel({
  cfg,
  update,
  onReplay,
  onRecord,
  recording,
  onSurprise,
  loop,
  onToggleLoop,
  getProgress,
}: PanelProps) {
  const [copied, setCopied] = useState(false);

  const copySettings = async () => {
    const text = JSON.stringify(cfg, null, 2);
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const secs = (v: number) => v / 1000 + "s";

  return (
    <aside id="panel">
      {/* globals */}
      <Slider
        label="Canvas zoom"
        min={0.3}
        max={1.6}
        step={0.05}
        value={cfg.zoom}
        onChange={(v) => update({ zoom: v })}
        format={(v) => v.toFixed(2)}
      />
      <Slider
        label="Density (grid gap)"
        min={1}
        max={11}
        step={0.1}
        value={cfg.gap}
        onChange={(v) => update({ gap: v })}
        format={(v) => v.toFixed(1)}
      />
      <Slider
        label="Dot size"
        min={0.5}
        max={2.5}
        step={0.1}
        value={cfg.size}
        onChange={(v) => update({ size: v })}
      />

      {/* ① timing */}
      <Section title="① Timing">
      <TimingBar getProgress={getProgress} />
      <Slider
        label="Speed"
        min={0.25}
        max={4}
        step={0.05}
        value={cfg.rvSpeed}
        onChange={(v) => update({ rvSpeed: v })}
        format={(v) => v.toFixed(2) + "×"}
      />
      <Segmented
        label="Opacity/scale speed"
        rows={LINK}
        value={cfg.rvSpeedLink ? "connect" : "disconnect"}
        onChange={(v) => update({ rvSpeedLink: v === "connect" })}
      />
      <Slider
        label="Start delay"
        min={0}
        max={2000}
        step={50}
        value={cfg.rvDelay}
        onChange={(v) => update({ rvDelay: v })}
        format={secs}
      />
      <BezierEditor
        label="Sweep easing"
        value={cfg.rvEase}
        onChange={(v: Bezier) => update({ rvEase: v })}
      />
      <Segmented
        label="Opacity/scale easing"
        rows={LINK}
        value={cfg.rvEaseLink ? "connect" : "disconnect"}
        onChange={(v) => update({ rvEaseLink: v === "connect" })}
      />
      </Section>

      {/* ② reveal pattern */}
      <Section title="② Reveal pattern">
      <Segmented
        label="Pattern"
        rows={PATTERN}
        value={cfg.rvPattern}
        onChange={(v) => update({ rvPattern: v as Config["rvPattern"] })}
      />
      {cfg.rvPattern === "sweep" ? (
        <>
          <Dial label="Direction" value={cfg.rvAngle} step={15} onChange={(v) => update({ rvAngle: v })} />
          <Slider
            label="Stagger"
            min={0}
            max={1}
            step={0.02}
            value={cfg.rvStagger}
            onChange={(v) => update({ rvStagger: v })}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="Curve bow"
            min={-3}
            max={3}
            step={0.05}
            value={cfg.rvCurveBow}
            onChange={(v) => update({ rvCurveBow: v })}
            format={(v) => v.toFixed(2)}
          />
        </>
      ) : (
        <>
          <Slider
            label="Seed count"
            min={1}
            max={20}
            step={1}
            value={cfg.rvSpotCount}
            onChange={(v) => update({ rvSpotCount: v })}
          />
          <Slider
            label="Spread speed"
            min={0.25}
            max={4}
            step={0.05}
            value={cfg.rvSpotSpread}
            onChange={(v) => update({ rvSpotSpread: v })}
            format={(v) => v.toFixed(2) + "×"}
          />
          <Slider
            label="Edge softness"
            min={0.02}
            max={0.6}
            step={0.01}
            value={cfg.rvSpotEdge}
            onChange={(v) => update({ rvSpotEdge: v })}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="Blob"
            min={0}
            max={1}
            step={0.02}
            value={cfg.rvSpotBlob}
            onChange={(v) => update({ rvSpotBlob: v })}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="Blob scale"
            min={0.5}
            max={6}
            step={0.1}
            value={cfg.rvSpotBlobScale}
            onChange={(v) => update({ rvSpotBlobScale: v })}
            format={(v) => v.toFixed(1)}
          />
          <button
            className="btn"
            onClick={() => {
              update({ rvSpotSeed: cfg.rvSpotSeed + 1 });
              onReplay();
            }}
          >
            ⟳ Re-roll seeds
          </button>
        </>
      )}
      </Section>

      {/* ③ opacity — its own fade-in curve + timing */}
      <Section title="③ Opacity">
      <Slider
        label="Start opacity"
        min={0}
        max={1}
        step={0.05}
        value={cfg.rvFade}
        onChange={(v) => update({ rvFade: v })}
        format={(v) => v.toFixed(2)}
      />
      {cfg.rvEaseLink ? (
        <div className="linked-note">Easing → linked to main</div>
      ) : (
        <BezierEditor
          label="Opacity easing"
          value={cfg.rvOpacEase}
          onChange={(v: Bezier) => update({ rvOpacEase: v })}
        />
      )}
      {cfg.rvSpeedLink ? (
        <div className="linked-note">Speed → linked to main</div>
      ) : (
        <Slider
          label="Speed"
          min={0.25}
          max={4}
          step={0.05}
          value={cfg.rvOpacSpeed}
          onChange={(v) => update({ rvOpacSpeed: v })}
          format={(v) => v.toFixed(2) + "×"}
        />
      )}
      <Slider
        label="Delay"
        min={0}
        max={2000}
        step={50}
        value={cfg.rvOpacDelay}
        onChange={(v) => update({ rvOpacDelay: v })}
        format={secs}
      />
      </Section>

      {/* ④ scale — its own grow-in curve + timing */}
      <Section title="④ Scale">
      <Slider
        label="Start scale"
        min={0}
        max={1}
        step={0.05}
        value={cfg.rvScale}
        onChange={(v) => update({ rvScale: v })}
        format={(v) => v.toFixed(2)}
      />
      {cfg.rvEaseLink ? (
        <div className="linked-note">Easing → linked to main</div>
      ) : (
        <BezierEditor
          label="Scale easing"
          value={cfg.rvScaleEase}
          onChange={(v: Bezier) => update({ rvScaleEase: v })}
        />
      )}
      {cfg.rvSpeedLink ? (
        <div className="linked-note">Speed → linked to main</div>
      ) : (
        <Slider
          label="Speed"
          min={0.25}
          max={4}
          step={0.05}
          value={cfg.rvScaleSpeed}
          onChange={(v) => update({ rvScaleSpeed: v })}
          format={(v) => v.toFixed(2) + "×"}
        />
      )}
      <Slider
        label="Delay"
        min={0}
        max={2000}
        step={50}
        value={cfg.rvScaleDelay}
        onChange={(v) => update({ rvScaleDelay: v })}
        format={secs}
      />
      </Section>

      {/* ⑤ motion into place */}
      <Section title="⑤ Motion">
      <Segmented
        label="Motion in"
        rows={MOTION}
        value={cfg.rvMotion}
        onChange={(v) => update({ rvMotion: v as Config["rvMotion"] })}
      />
      {cfg.rvMotion === "directional" ? (
        <>
          <Slider
            label="Offset X"
            min={-150}
            max={150}
            step={1}
            value={cfg.rvDirX}
            onChange={(v) => update({ rvDirX: v })}
            format={(v) => v + "px"}
          />
          <Slider
            label="Offset Y"
            min={-150}
            max={150}
            step={1}
            value={cfg.rvDirY}
            onChange={(v) => update({ rvDirY: v })}
            format={(v) => v + "px"}
          />
          <Slider
            label="Stiffness"
            min={0}
            max={1}
            step={0.01}
            value={cfg.rvStiffness}
            onChange={(v) => update({ rvStiffness: v })}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="Elasticity"
            min={0}
            max={1}
            step={0.01}
            value={cfg.rvElasticity}
            onChange={(v) => update({ rvElasticity: v })}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="Release delay"
            min={0}
            max={1.5}
            step={0.05}
            value={cfg.rvDirDelay}
            onChange={(v) => update({ rvDirDelay: v })}
            format={(v) => v.toFixed(2) + "s"}
          />
          <Slider
            label="Delay jitter"
            min={0}
            max={1}
            step={0.05}
            value={cfg.rvDirDelayJit}
            onChange={(v) => update({ rvDirDelayJit: v })}
            format={(v) => v.toFixed(2) + "s"}
          />
          <Slider
            label="Offset spread"
            min={0}
            max={1}
            step={0.02}
            value={cfg.rvDirSpread}
            onChange={(v) => update({ rvDirSpread: v })}
            format={(v) => v.toFixed(2)}
          />
        </>
      ) : (
        <Slider
          label="Motion distance"
          min={0}
          max={60}
          step={1}
          value={cfg.rvMotionDist}
          onChange={(v) => update({ rvMotionDist: v })}
          format={(v) => v + "px"}
        />
      )}
      <BezierEditor
        label="Motion easing"
        value={cfg.rvMotionEase}
        onChange={(v: Bezier) => update({ rvMotionEase: v })}
      />
      <Slider
        label="Speed"
        min={0.25}
        max={4}
        step={0.05}
        value={cfg.rvMotionSpeed}
        onChange={(v) => update({ rvMotionSpeed: v })}
        format={(v) => v.toFixed(2) + "×"}
      />
      <Slider
        label="Delay"
        min={0}
        max={2000}
        step={50}
        value={cfg.rvMotionDelay}
        onChange={(v) => update({ rvMotionDelay: v })}
        format={secs}
      />
      </Section>

      {/* ⑥ edge effects — three independent effects on the reveal wavefront */}
      <Section title="⑥ Edge effects">
      <Slider
        label="Edge sharpness"
        min={0}
        max={1}
        step={0.02}
        value={cfg.rvEdgeSharp}
        onChange={(v) => update({ rvEdgeSharp: v })}
        format={(v) => v.toFixed(2)}
      />
      <Slider
        label="Edge compression"
        min={0}
        max={1}
        step={0.02}
        value={cfg.rvEdgeComp}
        onChange={(v) => update({ rvEdgeComp: v })}
        format={(v) => v.toFixed(2)}
      />
      <Slider
        label="Burst strength"
        min={0}
        max={1}
        step={0.05}
        value={cfg.rvHi}
        onChange={(v) => update({ rvHi: v })}
        format={(v) => v.toFixed(2)}
      />
      <Slider
        label="Burst width"
        min={0.02}
        max={0.5}
        step={0.01}
        value={cfg.rvHiWidth}
        onChange={(v) => update({ rvHiWidth: v })}
        format={(v) => v.toFixed(2)}
      />
      </Section>

      {/* ⑦ crest — the hero: effects on the travelling leading-edge band */}
      <Section title="⑦ Crest">
      <Segmented
        label="Crest style"
        rows={CREST_STYLE}
        value={cfg.rvCrestStyle}
        onChange={(v) => update({ rvCrestStyle: v as Config["rvCrestStyle"] })}
      />
      <Slider
        label="Crest area"
        min={0.05}
        max={0.6}
        step={0.01}
        value={cfg.rvCrestArea}
        onChange={(v) => update({ rvCrestArea: v })}
        format={(v) => v.toFixed(2)}
      />
      {cfg.rvCrestStyle === "ascii" && (
        <>
          <Segmented
            label="Glyph set"
            rows={GLYPHS}
            value={cfg.rvAsciiGlyphs}
            onChange={(v) => update({ rvAsciiGlyphs: v })}
          />
          <Slider
            label="Scramble rate"
            min={1}
            max={30}
            step={1}
            value={cfg.rvAsciiRate}
            onChange={(v) => update({ rvAsciiRate: v })}
            format={(v) => v + "Hz"}
          />
          <Slider
            label="Glyph variety"
            min={0}
            max={1}
            step={0.02}
            value={cfg.rvAsciiVariety}
            onChange={(v) => update({ rvAsciiVariety: v })}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="Settle fade"
            min={0}
            max={1}
            step={0.02}
            value={cfg.rvAsciiFade}
            onChange={(v) => update({ rvAsciiFade: v })}
            format={(v) => v.toFixed(2)}
          />
        </>
      )}
      <Slider
        label="Chaos"
        min={0}
        max={1}
        step={0.02}
        value={cfg.rvChaos}
        onChange={(v) => update({ rvChaos: v })}
        format={(v) => v.toFixed(2)}
      />
      <Slider
        label="Spray"
        min={0}
        max={1}
        step={0.02}
        value={cfg.rvSpray}
        onChange={(v) => update({ rvSpray: v })}
        format={(v) => v.toFixed(2)}
      />
      <Slider
        label="Blink amount"
        min={0}
        max={1}
        step={0.02}
        value={cfg.rvBlinkAmt}
        onChange={(v) => update({ rvBlinkAmt: v })}
        format={(v) => v.toFixed(2)}
      />
      <Slider
        label="Blink rate"
        min={1}
        max={30}
        step={1}
        value={cfg.rvBlinkRate}
        onChange={(v) => update({ rvBlinkRate: v })}
        format={(v) => v + "Hz"}
      />
      <Slider
        label="Blink dim"
        min={0}
        max={1}
        step={0.05}
        value={cfg.rvBlinkDim}
        onChange={(v) => update({ rvBlinkDim: v })}
        format={(v) => v.toFixed(2)}
      />
      </Section>

      {/* ⑧ organic randomness */}
      <Section title="⑧ Organic randomness">
      <Slider
        label="Reveal-time jitter"
        min={0}
        max={0.5}
        step={0.01}
        value={cfg.rvJitterTime}
        onChange={(v) => update({ rvJitterTime: v })}
        format={(v) => v.toFixed(2)}
      />
      <Slider
        label="Appearance jitter"
        min={0}
        max={1}
        step={0.05}
        value={cfg.rvJitterAppear}
        onChange={(v) => update({ rvJitterAppear: v })}
        format={(v) => v.toFixed(2)}
      />
      </Section>

      <hr className="section" />
      <button className="btn primary" onClick={onReplay}>
        ↻ Replay reveal
      </button>
      <button className={loop ? "btn loop on" : "btn loop"} onClick={onToggleLoop}>
        {loop ? "⟲ Loop: on" : "⟲ Loop: off"}
      </button>
      <button className="btn" onClick={onSurprise}>
        ✦ Surprise me
      </button>
      <button className={recording ? "btn rec" : "btn"} onClick={onRecord}>
        {recording ? "■ Stop & save .webm" : "● Record reveal"}
      </button>
      <button className="btn" onClick={copySettings}>
        {copied ? "Copied!" : "Copy settings"}
      </button>

      <PresetBar cfg={cfg} onApply={update} onReplay={onReplay} />
    </aside>
  );
}
