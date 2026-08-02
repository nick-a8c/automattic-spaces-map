// Curated "Looks" — one-click reveal presets. Each is a reveal-only config bundle: it sets the
// motion parameters (rv*) but deliberately omits the globals (gap / size / color / bg / zoom), so
// applying a look changes how the map *reveals*, never your dot density, colour, or zoom.
// This is the shipped, code-defined counterpart to the user's own saved Presets.

import type { Config } from "./engine/types";

type Reveal = Partial<Config>;

// A clean, neutral reveal every look starts from, then overrides what gives it character.
const BASE: Reveal = {
  intro: "reveal",
  rvSpeed: 1,
  rvDelay: 0,
  rvEase: [0.4, 0, 0.2, 1],
  rvSpeedLink: true,
  rvEaseLink: true,
  rvPattern: "sweep",
  rvAngle: 0,
  rvStagger: 0.9,
  rvCurveBow: 0,
  rvSpotCount: 10,
  rvSpotSpread: 0.9,
  rvSpotEdge: 0.35,
  rvSpotSeed: 6,
  rvSpotBlob: 0,
  rvSpotBlobScale: 3,
  rvFade: 0,
  rvOpacEase: [0.4, 0, 0.2, 1],
  rvOpacSpeed: 2.6,
  rvOpacDelay: 0,
  rvScale: 0,
  rvScaleEase: [0.4, 0, 0.2, 1],
  rvScaleSpeed: 2.6,
  rvScaleDelay: 0,
  rvMotion: "none",
  rvMotionDist: 16,
  rvDirX: -50,
  rvDirY: -50,
  rvStiffness: 0.3,
  rvElasticity: 0.3,
  rvDirDelay: 0,
  rvDirDelayJit: 0,
  rvDirSpread: 1,
  rvMotionEase: [0.4, 0, 0.2, 1],
  rvMotionSpeed: 2.6,
  rvMotionDelay: 0,
  rvEdgeSharp: 0,
  rvEdgeComp: 0,
  rvHi: 0,
  rvHiWidth: 0.4,
  rvCrestArea: 0.25,
  rvChaos: 0,
  rvSpray: 0,
  rvBlinkRate: 11,
  rvBlinkAmt: 0,
  rvBlinkDim: 0.25,
  rvCrestStyle: "dots",
  rvAsciiGlyphs: "01XO",
  rvAsciiRate: 14,
  rvAsciiVariety: 0.4,
  rvAsciiFade: 0.4,
  rvJitterTime: 0,
  rvJitterAppear: 0,
};

export interface Look {
  id: string;
  name: string;
  desc: string;
  patch: Reveal;
}

export const LOOKS: Look[] = [
  {
    id: "sweep",
    name: "Sweep",
    desc: "a clean directional wash",
    patch: { ...BASE, rvAngle: 20, rvStagger: 0.9, rvCurveBow: 0.6, rvHi: 0.5, rvHiWidth: 0.35 },
  },
  {
    id: "spring",
    name: "Corner spring",
    desc: "flies in and settles",
    patch: {
      ...BASE, rvAngle: 45, rvStagger: 0.8, rvMotion: "directional",
      rvDirX: -70, rvDirY: -70, rvStiffness: 0.35, rvElasticity: 0.45, rvDirSpread: 1, rvSpeed: 0.9,
    },
  },
  {
    id: "decode",
    name: "Decode",
    desc: "scrambles into place",
    patch: {
      ...BASE, rvSpeed: 0.85, rvStagger: 1, rvHi: 0.5,
      rvCrestStyle: "ascii", rvCrestArea: 0.3, rvAsciiVariety: 0.4, rvAsciiFade: 0.45, rvAsciiRate: 14,
    },
  },
  {
    id: "bloom",
    name: "Bloom",
    desc: "grows from seed points",
    patch: {
      ...BASE, rvPattern: "spotty", rvSpeed: 0.9, rvScale: 0.1,
      rvSpotCount: 9, rvSpotSpread: 0.9, rvSpotEdge: 0.38, rvSpotBlob: 0.35, rvSpotBlobScale: 3.2,
    },
  },
  {
    id: "cascade",
    name: "Cascade",
    desc: "top-down with a lift",
    patch: {
      ...BASE, rvAngle: 0, rvStagger: 1, rvCurveBow: -0.4,
      rvMotion: "rise", rvMotionDist: 16, rvScale: 0.25,
    },
  },
  {
    id: "fade",
    name: "Fade",
    desc: "simple and quiet",
    patch: { ...BASE, rvStagger: 0.25, rvSpeed: 0.7, rvHi: 0, rvMotion: "none" },
  },
];
