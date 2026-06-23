"use client";

import { useEffect, useState } from "react";
import { BUILD_MODE_EVENT, isBuildMode, setBuildMode } from "@/lib/build-mode";

// Enters Build mode — the focused, chrome-free scheduling surface. The actual
// state + the "Exit build mode" control live with the grid's command strip; this
// is the entry point shown in the normal toolbar (hidden once build mode is on).
export default function BuildModeToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const sync = () => setOn(isBuildMode());
    sync();
    window.addEventListener(BUILD_MODE_EVENT, sync);
    return () => {
      window.removeEventListener(BUILD_MODE_EVENT, sync);
      // Leaving the schedule page clears build mode so it never bleeds elsewhere.
      setBuildMode(false);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => setBuildMode(!isBuildMode())}
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
