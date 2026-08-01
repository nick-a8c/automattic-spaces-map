// Reusable dotted-map canvas: owns a DotFieldEngine instance driven by `cfg`.
// Used by both the Builder view and the Site embed. Exposes replayIntro() imperatively.

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { DotFieldEngine } from "../engine/DotFieldEngine";
import type { Config } from "../engine/types";

export interface MapHandle {
  replayIntro: () => void;
  getCanvas: () => HTMLCanvasElement | null;
  getProgress: () => number;
}

export const MapCanvas = forwardRef<MapHandle, { cfg: Config; className?: string }>(
  function MapCanvas({ cfg, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const engineRef = useRef<DotFieldEngine | null>(null);
    const cfgRef = useRef(cfg);
    cfgRef.current = cfg;

    useEffect(() => {
      const engine = new DotFieldEngine(canvasRef.current!, cfgRef.current);
      engineRef.current = engine;
      engine.load(`${import.meta.env.BASE_URL}map.svg`);
      return () => {
        engine.destroy();
        engineRef.current = null;
      };
    }, []);

    useEffect(() => {
      engineRef.current?.setConfig(cfg);
    }, [cfg]);

    useImperativeHandle(
      ref,
      () => ({
        replayIntro: () => engineRef.current?.replayIntro(),
        getCanvas: () => canvasRef.current,
        getProgress: () => engineRef.current?.getProgress() ?? 1,
      }),
      [],
    );

    return <canvas ref={canvasRef} className={className} />;
  },
);
