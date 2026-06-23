"use client";

import { useEffect, useState } from "react";

// Build mode maximizes the schedule grid: it collapses the sidebar and hides the
// page chrome (location pills, extra padding) by toggling `html.schedule-build`,
// then nudges the grid to refit. The grid's own JS height (window.innerHeight −
// top) grows automatically once the chrome above it is gone. Transient — it
// survives router.refresh (the class lives on <html>) and clears when you leave
// the schedule page, so it never bleeds into other screens.
export default function BuildModeToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(document.documentElement.classList.contains("schedule-build"));
    return () => {
      document.documentElement.classList.remove("schedule-build");
    };
  }, []);

  function toggle() {
    const root = document.documentElement;
    const next = !root.classList.contains("schedule-build");
    root.classList.toggle("schedule-build", next);
    // Build mode leans on a collapsed sidebar for the horizontal room.
    if (next) {
      root.classList.add("sidebar-collapsed");
      try {
        localStorage.setItem("rx-sidebar-collapsed", "1");
      } catch {}
    }
    setOn(next);
    // The grid frame recomputes its height on resize — fire one now that the
    // chrome above it changed.
    window.dispatchEvent(new Event("resize"));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title="Hide the chrome and fill the screen with the schedule grid"
      className={`whitespace-nowrap rounded-md border px-3 py-1.5 font-brand text-[13px] font-semibold transition-colors ${
        on
          ? "border-amber bg-amber text-white hover:bg-amber-dark"
          : "border-line bg-surface text-navy hover:border-navy"
      }`}
    >
      {on ? "Exit build mode" : "Build mode"}
    </button>
  );
}
