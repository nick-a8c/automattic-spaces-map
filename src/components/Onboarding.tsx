// First-run walkthrough for Simple mode. Shown once for new visitors (App gates on localStorage),
// and re-openable from the bottom-left "How it works" button. Illustrations are static inline SVG
// (rendered via innerHTML), styled by the .onboarding-scoped classes in index.css.

import { useEffect, type ReactNode } from "react";

// step illustrations (kept as raw SVG so they read like the drawings they are)
const ART: Record<string, string> = {
  look: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g class="ink" fill="none" stroke-width="1.5"><rect x="12" y="30" width="52" height="52" rx="8"/><rect x="74" y="30" width="52" height="52" rx="8"/><rect x="136" y="30" width="52" height="52" rx="8"/></g>
    <rect x="73" y="29" width="54" height="54" rx="9" fill="none" class="acc" stroke-width="2"/>
    <g class="dotf">
      <circle cx="22" cy="44" r="1.4"/><circle cx="30" cy="44" r="1.4"/><circle cx="38" cy="44" r="1.4"/><circle cx="46" cy="44" r="1.4"/><circle cx="54" cy="44" r="1.4"/>
      <circle cx="22" cy="56" r="1.4"/><circle cx="30" cy="56" r="1.4"/><circle cx="38" cy="56" r="1.4"/><circle cx="46" cy="56" r="1.4"/>
      <circle cx="22" cy="68" r="1.4"/><circle cx="30" cy="68" r="1.4"/><circle cx="38" cy="68" r="1.4"/>
      <circle cx="100" cy="56" r="1.6"/><circle cx="92" cy="56" r="1.4"/><circle cx="108" cy="56" r="1.4"/><circle cx="100" cy="48" r="1.4"/><circle cx="100" cy="64" r="1.4"/>
      <circle cx="86" cy="48" r="1.3"/><circle cx="114" cy="48" r="1.3"/><circle cx="86" cy="64" r="1.3"/><circle cx="114" cy="64" r="1.3"/>
      <circle cx="100" cy="40" r="1.2"/><circle cx="100" cy="72" r="1.2"/><circle cx="82" cy="56" r="1.2"/><circle cx="118" cy="56" r="1.2"/>
      <circle cx="150" cy="46" r="1.4"/><circle cx="156" cy="50" r="1.4"/><circle cx="152" cy="56" r="1.4"/><circle cx="146" cy="52" r="1.3"/>
      <circle cx="172" cy="62" r="1.4"/><circle cx="178" cy="58" r="1.4"/><circle cx="176" cy="66" r="1.3"/><circle cx="168" cy="66" r="1.3"/>
      <circle cx="164" cy="44" r="1.2"/><circle cx="182" cy="48" r="1.2"/>
    </g>
    <path d="M104 84 l0 16 l4 -4 l3 6 l3 -1 l-3 -6 l6 0 z" class="accf" stroke="var(--card)" stroke-width="1"/>
  </svg>`,
  feel: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="46" y="14" width="108" height="92" rx="10" fill="none" class="ink" stroke-width="1.5"/>
    <line x1="100" y1="14" x2="100" y2="106" class="ink" stroke-width="1" stroke-dasharray="3 3"/>
    <line x1="46" y1="60" x2="154" y2="60" class="ink" stroke-width="1" stroke-dasharray="3 3"/>
    <text x="100" y="26" text-anchor="middle" class="lab">SMOOTH</text><text x="100" y="100" text-anchor="middle" class="lab">RIGID</text>
    <text x="52" y="63" class="lab">SLOW</text><text x="148" y="63" text-anchor="end" class="lab">FAST</text>
    <path d="M74 82 q26 -6 44 -34" fill="none" class="acc" stroke-width="1.5" stroke-dasharray="4 3"/>
    <polygon points="118,48 112,50 116,55" class="accf"/>
    <circle cx="74" cy="82" r="6" class="accf" stroke="var(--card)" stroke-width="2"/>
  </svg>`,
  pattern: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g fill="none" class="ink" stroke-width="1.5"><rect x="8" y="34" width="54" height="54" rx="8"/><rect x="73" y="34" width="54" height="54" rx="8"/><rect x="138" y="34" width="54" height="54" rx="8"/></g>
    <g class="dotf" opacity="0.9"><circle cx="18" cy="46" r="1.3"/><circle cx="26" cy="46" r="1.3"/><circle cx="34" cy="46" r="1.3"/><circle cx="18" cy="56" r="1.3"/><circle cx="26" cy="56" r="1.3"/><circle cx="18" cy="66" r="1.3"/></g>
    <path d="M14 80 l34 -34" class="acc" stroke-width="1.5" fill="none"/><polygon points="48,46 41,47 45,53" class="accf"/><text x="35" y="99" text-anchor="middle" class="lab">SWEEP</text>
    <g class="dotf"><circle cx="88" cy="50" r="1.3"/><circle cx="94" cy="54" r="1.3"/><circle cx="90" cy="58" r="1.3"/><circle cx="84" cy="54" r="1.2"/><circle cx="110" cy="66" r="1.3"/><circle cx="116" cy="62" r="1.3"/><circle cx="114" cy="70" r="1.2"/><circle cx="106" cy="48" r="1.2"/><circle cx="98" cy="70" r="1.2"/></g>
    <text x="100" y="99" text-anchor="middle" class="lab">SPOTTY</text>
    <g fill="none" class="acc" stroke-width="1" opacity="0.55"><circle cx="165" cy="60" r="7"/><circle cx="165" cy="60" r="13"/><circle cx="165" cy="60" r="19"/></g>
    <circle cx="165" cy="60" r="1.8" class="accf"/><text x="165" y="99" text-anchor="middle" class="lab">RADIAL</text>
  </svg>`,
  tune: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g class="ink" stroke-width="3" stroke-linecap="round"><line x1="24" y1="42" x2="176" y2="42"/><line x1="24" y1="72" x2="176" y2="72"/></g>
    <g class="acc" stroke-width="3" stroke-linecap="round"><line x1="24" y1="42" x2="86" y2="42"/><line x1="24" y1="72" x2="128" y2="72"/></g>
    <circle cx="86" cy="42" r="6" class="accf" stroke="var(--card)" stroke-width="2"/><circle cx="128" cy="72" r="6" class="accf" stroke="var(--card)" stroke-width="2"/>
    <text x="24" y="32" class="lab">SPEED</text><text x="24" y="62" class="lab">SQUISH / DIRECTION</text><text x="176" y="98" text-anchor="end" class="lab">JUST 2-3 DIALS</text>
  </svg>`,
  pin: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="14" y="16" width="172" height="88" rx="10" fill="none" class="ink" stroke-width="1.5"/>
    <g fill="none" class="acc" stroke-width="1.2" opacity="0.5"><circle cx="78" cy="60" r="12"/><circle cx="78" cy="60" r="22"/><circle cx="78" cy="60" r="32"/></g>
    <path d="M78 60 C78 50 92 50 92 40 C92 31 84 27 78 27 C72 27 64 31 64 40 C64 50 78 50 78 60 Z" class="accf" stroke="var(--card)" stroke-width="1.5"/>
    <circle cx="78" cy="39" r="4" fill="var(--card)"/>
    <path d="M120 66 l0 16 l4 -4 l3 6 l3 -1 l-3 -6 l6 0 z" fill="var(--ink)" stroke="var(--card)" stroke-width="1"/>
    <text x="18" y="98" class="lab">CLICK TO SET THE EPICENTER</text>
  </svg>`,
  dots: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g class="dotf"><circle cx="26" cy="40" r="1.4"/><circle cx="42" cy="40" r="1.4"/><circle cx="58" cy="40" r="1.4"/><circle cx="26" cy="56" r="1.4"/><circle cx="42" cy="56" r="1.4"/><circle cx="58" cy="56" r="1.4"/><circle cx="26" cy="72" r="1.4"/><circle cx="42" cy="72" r="1.4"/><circle cx="58" cy="72" r="1.4"/></g>
    <path d="M74 56 l20 0" class="ink" stroke-width="1.5" fill="none"/><polygon points="94,56 88,53 88,59" fill="var(--faint)"/>
    <g class="dotf">
      <circle cx="112" cy="40" r="2.2"/><circle cx="122" cy="40" r="2.2"/><circle cx="132" cy="40" r="2.2"/><circle cx="142" cy="40" r="2.2"/><circle cx="152" cy="40" r="2.2"/><circle cx="162" cy="40" r="2.2"/><circle cx="172" cy="40" r="2.2"/>
      <circle cx="112" cy="50" r="2.2"/><circle cx="122" cy="50" r="2.2"/><circle cx="132" cy="50" r="2.2"/><circle cx="142" cy="50" r="2.2"/><circle cx="152" cy="50" r="2.2"/><circle cx="162" cy="50" r="2.2"/><circle cx="172" cy="50" r="2.2"/>
      <circle cx="112" cy="60" r="2.2"/><circle cx="122" cy="60" r="2.2"/><circle cx="132" cy="60" r="2.2"/><circle cx="142" cy="60" r="2.2"/><circle cx="152" cy="60" r="2.2"/><circle cx="162" cy="60" r="2.2"/><circle cx="172" cy="60" r="2.2"/>
      <circle cx="112" cy="70" r="2.2"/><circle cx="122" cy="70" r="2.2"/><circle cx="132" cy="70" r="2.2"/><circle cx="142" cy="70" r="2.2"/><circle cx="152" cy="70" r="2.2"/><circle cx="162" cy="70" r="2.2"/><circle cx="172" cy="70" r="2.2"/>
    </g>
    <text x="42" y="96" text-anchor="middle" class="lab">FEWER / SMALL</text><text x="142" y="96" text-anchor="middle" class="lab">MORE / BIG</text>
  </svg>`,
  play: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="30" y="20" width="140" height="24" rx="7" class="accf"/>
    <rect x="30" y="50" width="140" height="24" rx="7" fill="none" class="ink" stroke-width="1.5"/>
    <rect x="30" y="80" width="140" height="24" rx="7" fill="none" class="ink" stroke-width="1.5"/>
    <path d="M62 27 a5 5 0 1 0 5 -5 M67 22 v5 h-5" fill="none" stroke="var(--card)" stroke-width="1.6"/>
    <text x="100" y="35" text-anchor="middle" fill="var(--card)" style="font:700 9px system-ui">REPLAY</text>
    <text x="100" y="65" text-anchor="middle" class="lab" style="fill:var(--muted)">SURPRISE ME</text>
    <text x="100" y="95" text-anchor="middle" class="lab" style="fill:var(--muted)">RECORD REVEAL</text>
  </svg>`,
};

function Step({
  num,
  title,
  tag,
  art,
  children,
}: {
  num: string;
  title: string;
  tag?: string;
  art: string;
  children: ReactNode;
}) {
  return (
    <div className="ob-step">
      <div className="ob-art" dangerouslySetInnerHTML={{ __html: art }} />
      <div>
        {tag && <span className="ob-tag">{tag}</span>}
        <span className="ob-num">{num}</span>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </div>
  );
}

export function Onboarding({ onClose }: { onClose: () => void }) {
  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ob-overlay" onClick={onClose}>
      <div className="onboarding" role="dialog" aria-label="How the tool works" onClick={(e) => e.stopPropagation()}>
        <button className="ob-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="ob-eyebrow">Getting started</div>
        <h1 className="ob-h1">Automattic.com/spaces</h1>

        <div className="ob-space">
          <kbd className="ob-key">Space</kbd>
          <div>
            Press <b>Space</b> anytime to <b>play the reveal</b>.
          </div>
        </div>

        <div className="ob-note">
          <span className="ob-badge">Tip</span>
          <div>
            If <b>Simple</b> is too simple for you, test <b>Pro</b> and see if it's a better fit.
          </div>
        </div>

        <div className="ob-steps">
          <Step num="1" title="Start with a look" art={ART.look}>
            Tap <b>Browse looks</b> and pick one you like — Ripple, Sweep, Decode… It sets a good starting
            point in one click. You'll tweak from there.
          </Step>
          <Step num="2" title="Nudge the feel" art={ART.feel}>
            Drag the dot on the <b>Feel</b> pad. Left–right = <b>slow to fast</b>; down–up = <b>rigid to
            smooth</b>. One drag sets the whole vibe. Let go and it previews.
          </Step>
          <Step num="3" title="Pick how it appears" art={ART.pattern}>
            Choose a <b>Pattern</b>: <b>Sweep</b> wipes across in a direction, <b>Spotty</b> grows from
            patches, <b>Radial</b> bursts out in a ring from a point.
          </Step>
          <Step num="4" title="Fine-tune the essentials" art={ART.tune}>
            A couple of plain sliders under the pattern: <b>Speed</b>, plus the two that matter for the
            pattern you chose (like <b>Squish</b> &amp; <b>Foam</b> for Radial). That's it.
          </Step>
          <Step num="5" title="Drop the origin pin" tag="Radial only" art={ART.pin}>
            Hit <b>Place origin pin</b>, then <b>click anywhere on the map</b> — that's where the wave is
            born. Put it over a city, a corner, wherever you want the burst to start.
          </Step>
          <Step num="6" title="Shape the dots" art={ART.dots}>
            Set <b>Density</b> (how many dots) and <b>Dot size</b>. Went too far? <b>Reset dots</b> snaps
            both back to the defaults.
          </Step>
          <Step num="7" title="Play it · save it" art={ART.play}>
            <b>Replay</b> — or just the <b>Space</b> key — runs it again, <b>Surprise me</b> rolls a random
            variation, and <b>Record reveal</b> saves it as a video. These three always sit at the bottom.
          </Step>
        </div>

        <button className="btn primary ob-done" onClick={onClose}>
          Got it — let's go
        </button>
      </div>
    </div>
  );
}
