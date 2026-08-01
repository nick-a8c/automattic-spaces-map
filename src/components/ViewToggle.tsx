// Fixed corner switch to flip between the Builder tool and the Site preview.
// Deliberately styled as a neutral dev control so it reads as neither design.

export type View = "builder" | "site";

export function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="view-toggle">
      <button className={view === "builder" ? "on" : ""} onClick={() => onChange("builder")}>
        Builder
      </button>
      <button className={view === "site" ? "on" : ""} onClick={() => onChange("site")}>
        Site
      </button>
    </div>
  );
}
