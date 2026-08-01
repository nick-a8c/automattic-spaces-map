// Pixel replica of the Automattic Spaces page (from website.pdf). Our dotted map
// replaces the map slot; photos are the real ones extracted from the PDF.

import type { Ref } from "react";
import type { Config } from "../engine/types";
import { MapCanvas, type MapHandle } from "../components/MapCanvas";
import "./spaces.css";

// public/ assets resolve from the deploy base (e.g. /automattic-spaces-map/) — not root
const BASE = import.meta.env.BASE_URL;

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

export function SpacesPage({ cfg, mapRef }: { cfg: Config; mapRef?: Ref<MapHandle> }) {
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
            {MARKERS.map((m) => (
              <div
                key={m.name}
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
    </div>
  );
}
