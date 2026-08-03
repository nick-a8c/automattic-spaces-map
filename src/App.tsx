import { useEffect, useRef, useState } from "react";
import { DEFAULT_CONFIG, type Config } from "./engine/types";
import { Panel } from "./components/Panel";
import { MapCanvas, type MapHandle } from "./components/MapCanvas";
import { ViewToggle, type View } from "./components/ViewToggle";
import { SpacesPage, DEFAULT_MARKER_ANIM, type MarkerAnim } from "./site/SpacesPage";
import { LooksGallery } from "./components/LooksGallery";
import { Timeline } from "./components/Timeline";
import type { Look } from "./looks";

function makeInitialConfig(): Config {
  return { ...DEFAULT_CONFIG };
}

// Pick a supported WebM codec for MediaRecorder (VP9 → VP8 → generic).
function pickMime(): string {
  const opts = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return opts.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) ?? "video/webm";
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: readonly T[]): T => arr[(Math.random() * arr.length) | 0];
const chance = (p: number) => Math.random() < p;
const round2 = (v: number) => Math.round(v * 100) / 100;

// "Surprise me" — randomize the expressive reveal params only. Dots (gap/size/shape),
// color, background, and zoom stay put; both sweep and spotty params get fresh values so
// toggling the pattern after a surprise still lands somewhere interesting.
function surprisePatch(cfg: Config): Partial<Config> {
  return {
    rvPattern: pick(["sweep", "spotty"] as const),
    rvSpeed: round2(rnd(0.45, 1.6)),
    rvDelay: 0,
    // sweep
    rvAngle: Math.round(rnd(0, 24)) * 15,
    rvStagger: round2(rnd(0.4, 1)),
    rvCurveBow: round2(rnd(-2, 2)),
    // spotty
    rvSpotCount: Math.round(rnd(3, 16)),
    rvSpotSpread: round2(rnd(0.5, 1.6)),
    rvSpotEdge: round2(rnd(0.1, 0.5)),
    rvSpotSeed: cfg.rvSpotSeed + 1,
    rvSpotBlob: round2(rnd(0, 0.6)),
    rvSpotBlobScale: round2(rnd(1.5, 5)),
    // opacity / scale starting points
    rvFade: chance(0.5) ? 0 : round2(rnd(0, 0.4)),
    rvScale: chance(0.5) ? 0 : round2(rnd(0, 0.5)),
    // motion into place
    rvMotion: pick(["none", "rise", "fall", "scatter", "directional"] as const),
    rvMotionDist: Math.round(rnd(6, 40)),
    rvDirX: Math.round(rnd(-60, 60)),
    rvDirY: Math.round(rnd(-60, 60)),
    rvStiffness: round2(rnd(0, 0.6)),
    rvElasticity: round2(rnd(0, 0.6)),
    rvDirSpread: round2(rnd(0, 1)),
    // edge effects
    rvEdgeSharp: round2(rnd(0, 0.6)),
    rvEdgeComp: round2(rnd(0, 0.6)),
    rvHi: round2(rnd(0, 1)),
    rvHiWidth: round2(rnd(0.1, 0.5)),
    // crest
    rvChaos: chance(0.4) ? round2(rnd(0, 0.6)) : 0,
    rvSpray: chance(0.3) ? round2(rnd(0, 0.5)) : 0,
    rvBlinkAmt: chance(0.4) ? round2(rnd(0.2, 0.7)) : 0,
    // organic
    rvJitterTime: round2(rnd(0, 0.2)),
  };
}

export default function App() {
  const [cfg, setCfg] = useState<Config>(makeInitialConfig);
  const [view, setView] = useState<View>("builder");
  const [recording, setRecording] = useState(false);
  const [loop, setLoop] = useState(false);
  const [looksOpen, setLooksOpen] = useState(false);
  const [activeLook, setActiveLook] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [markerAnim, setMarkerAnim] = useState<MarkerAnim>(DEFAULT_MARKER_ANIM);
  const mapRef = useRef<MapHandle>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  const update = (patch: Partial<Config>) => setCfg((c) => ({ ...c, ...patch }));

  const pickLook = (look: Look) => {
    update(look.patch);
    setActiveLook(look.id);
    mapRef.current?.replayIntro();
    setLooksOpen(false);
  };

  const surprise = () => {
    setCfg((c) => ({ ...c, ...surprisePatch(c) }));
    mapRef.current?.replayIntro();
  };

  // Auto-replay loop: re-run the reveal on a cadence derived from the current speed/delay
  // (fixed ~3.2s base ÷ speed + start delay + a short pause). Recomputes when either changes.
  useEffect(() => {
    if (!loop) return;
    const cycle = cfg.rvDelay + 3200 / cfg.rvSpeed + 1400;
    mapRef.current?.replayIntro();
    const id = window.setInterval(() => mapRef.current?.replayIntro(), cycle);
    return () => window.clearInterval(id);
  }, [loop, cfg.rvSpeed, cfg.rvDelay]);

  // Record the live reveal to a WebM (canvas.captureStream + MediaRecorder). Toggle start/stop.
  const record = () => {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    const canvas = mapRef.current?.getCanvas();
    if (!canvas || !window.MediaRecorder) return;
    const stream = canvas.captureStream(60);
    const rec = new MediaRecorder(stream, { mimeType: pickMime(), videoBitsPerSecond: 12_000_000 });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dotted-map-reveal.webm";
      a.click();
      URL.revokeObjectURL(url);
      recRef.current = null;
      setRecording(false);
    };
    recRef.current = rec;
    setRecording(true);
    rec.start();
    mapRef.current?.replayIntro(); // record from the top
  };

  // Space replays the reveal (in either view). Ignore it while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "TEXTAREA" || el?.isContentEditable) return;
      if (tag === "INPUT" && (el as HTMLInputElement).type !== "range") return;
      e.preventDefault();
      mapRef.current?.replayIntro();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <ViewToggle view={view} onChange={setView} />

      {view === "builder" ? (
        <div className="builder-layout">
          <div id="stage-col">
            <div id="stage">
              <div
                id="mapwrap"
                style={{ transform: `scale(${cfg.zoom})`, transformOrigin: "center center" }}
              >
                <MapCanvas ref={mapRef} cfg={cfg} />
              </div>
            </div>
            {timelineOpen && (
              <Timeline
                cfg={cfg}
                update={update}
                getProgress={() => mapRef.current?.getProgress() ?? 1}
                onReplay={() => mapRef.current?.replayIntro()}
                onClose={() => setTimelineOpen(false)}
              />
            )}
          </div>
          <Panel
            cfg={cfg}
            update={update}
            onReplay={() => mapRef.current?.replayIntro()}
            onRecord={record}
            recording={recording}
            onSurprise={surprise}
            loop={loop}
            onToggleLoop={() => setLoop((l) => !l)}
            getProgress={() => mapRef.current?.getProgress() ?? 1}
            onOpenLooks={() => setLooksOpen(true)}
            onToggleTimeline={() => setTimelineOpen((o) => !o)}
            timelineOn={timelineOpen}
          />
          {looksOpen && (
            <LooksGallery
              onClose={() => setLooksOpen(false)}
              onPick={pickLook}
              activeId={activeLook}
            />
          )}
        </div>
      ) : (
        <SpacesPage
          cfg={cfg}
          mapRef={mapRef}
          anim={markerAnim}
          setAnim={setMarkerAnim}
          onReplayMap={() => mapRef.current?.replayIntro()}
        />
      )}
    </>
  );
}
