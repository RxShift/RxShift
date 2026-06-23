// Shared client helpers for the schedule "Build mode" — a focused, chrome-free
// scheduling surface. Build mode is a transient client state held as the
// `schedule-build` class on <html> (so CSS can hide the page chrome + banners and
// the sidebar stays collapsed). The schedule matrix renders its consolidated
// command strip when it's on. A custom `rx-build-mode` event lets every interested
// component (the toggle's label, the matrix) react to changes.

export const BUILD_MODE_EVENT = "rx-build-mode";

export function isBuildMode(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("schedule-build");
}

export function setBuildMode(on: boolean): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("schedule-build", on);
  // Build mode leans on a collapsed sidebar for the horizontal room.
  if (on) {
    root.classList.add("sidebar-collapsed");
    try {
      localStorage.setItem("rx-sidebar-collapsed", "1");
    } catch {}
  }
  window.dispatchEvent(new Event(BUILD_MODE_EVENT));
  // The grid frame recomputes its height on resize — fire one now that the
  // chrome above/around it changed.
  window.dispatchEvent(new Event("resize"));
}
