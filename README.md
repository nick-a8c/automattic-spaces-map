# Dotted World Map — React rebuild

A React + Vite + TypeScript tool that renders the world map as a field of dots on a
`<canvas>` and plays a fully parameterized **Reveal** animation. Two views: a **Builder**
(map + control panel) and a **Site** (automattic.com/spaces replica with the map in it).

**Live:** https://nick-a8c.github.io/automattic-spaces-map/

## Deploy

Hosted on GitHub Pages — no server or terminal needed to run it. Every push to `main`
triggers `.github/workflows/deploy.yml`, which builds and publishes `dist/` automatically.
The Vite `base` is `/automattic-spaces-map/`; runtime asset loads use `import.meta.env.BASE_URL`
so they resolve on the Pages sub-path.

## Run locally

```bash
npm install
npm run dev -- --port 5180   # http://localhost:5180
npm run build                # tsc -b && vite build → dist/  (typecheck)
```

Press **Space** to replay the reveal; the bottom-left toggle flips Builder ⇄ Site.

## Docs

See **[HANDOFF.md](./HANDOFF.md)** for the full picture — control map, architecture,
the engine's reveal model, the Playwright verification setup, and gotchas.

The canvas engine (`src/engine/DotFieldEngine.ts`) is framework-agnostic: it takes a
`<canvas>` + a `Config` snapshot and owns all runtime state. React owns `Config` as the
single source of truth (`DEFAULT_CONFIG` in `src/engine/types.ts`) and feeds the engine
via `setConfig()`.
