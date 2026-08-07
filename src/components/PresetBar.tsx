// Presets + paste-settings. Save the current look to localStorage, reload/delete saved looks,
// or paste a settings JSON to apply it live — so tuning doesn't require editing DEFAULT_CONFIG.

import { useState } from "react";
import { DEFAULT_CONFIG, type Config } from "../engine/types";

const KEY = "dwm-presets";
const CONFIG_KEYS = Object.keys(DEFAULT_CONFIG) as (keyof Config)[];

/** Keep only keys that belong to Config — ignores legacy/extra fields in pasted JSON. */
function sanitize(obj: unknown): Partial<Config> {
  const out: Record<string, unknown> = {};
  if (obj && typeof obj === "object") {
    const src = obj as Record<string, unknown>;
    for (const k of CONFIG_KEYS) if (k in src) out[k] = src[k];
  }
  return out as Partial<Config>;
}
function loadPresets(): Record<string, Partial<Config>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function PresetBar({
  cfg,
  onApply,
  onReplay,
}: {
  cfg: Config;
  onApply: (p: Partial<Config>) => void;
  onReplay: () => void;
}) {
  const [presets, setPresets] = useState<Record<string, Partial<Config>>>(loadPresets);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false); // collapsed by default

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 1800);
  };
  const persist = (p: Record<string, Partial<Config>>) => {
    setPresets(p);
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* storage full/blocked — presets just won't persist */
    }
  };
  const apply = (p: Partial<Config>, label: string) => {
    onApply(p);
    onReplay();
    flash(label);
  };
  const save = () => {
    const n = name.trim();
    if (!n) return;
    persist({ ...presets, [n]: sanitize(cfg) });
    setName("");
    flash(`Saved “${n}”`);
  };
  const del = (n: string) => {
    const p = { ...presets };
    delete p[n];
    persist(p);
  };

  const names = Object.keys(presets);
  return (
    <div className="presetbar">
      <hr className="section" />
      <button className="rev-head rev-head-btn" onClick={() => setOpen((o) => !o)}>
        <span>Presets</span>
        <span className="rev-caret">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <>
          {names.length > 0 && (
            <div className="preset-list">
              {names.map((n) => (
                <div className="preset-row" key={n}>
                  <button className="preset-name" onClick={() => apply(presets[n], `Loaded “${n}”`)}>
                    {n}
                  </button>
                  <button className="preset-x" onClick={() => del(n)} title="Delete">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="preset-save">
            <input
              className="preset-input"
              placeholder="preset name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
            <button className="btn" onClick={save}>
              Save current
            </button>
          </div>
          {msg && <div className="preset-msg">{msg}</div>}
        </>
      )}
    </div>
  );
}
