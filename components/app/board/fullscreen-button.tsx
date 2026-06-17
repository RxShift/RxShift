"use client";

import { useEffect, useState } from "react";

// Toggles the browser's native fullscreen on the whole document — handy for a
// wall monitor or a quick across-the-room glance. Pure client, no dependency.
export default function FullscreenButton({ className }: { className?: string }) {
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const onChange = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggle() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen can be blocked (e.g. iframes / permissions) — ignore.
    }
  }

  return (
    <button type="button" onClick={toggle} className={className}>
      {fs ? "Exit full screen" : "Full screen"}
    </button>
  );
}
