"use client";

// Always reachable: a FIXED tab on the left edge, shown only while the sidebar
// is collapsed (CSS `.app-sidebar-reopen` in globals.css toggles display;
// desktop only). It used to live inside the page header, which scrolls away — so
// once you scrolled down a long page there was no way to re-expand the nav. Being
// fixed (not in page chrome) it stays reachable at any scroll position, and build
// mode — which hides the page header entirely — can still restore the nav.
export default function SidebarReopenButton() {
  function expand() {
    try {
      document.documentElement.classList.remove("sidebar-collapsed");
      localStorage.setItem("rx-sidebar-collapsed", "0");
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={expand}
      aria-label="Show navigation"
      title="Show menu"
      className="app-sidebar-reopen fixed left-0 top-1/2 z-40 h-12 w-6 -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 border-white/10 bg-[#1C2F5E] text-white/70 shadow-md transition-colors hover:w-7 hover:bg-[#162650] hover:text-white"
    >
      <span aria-hidden className="font-brand text-base font-bold leading-none">
        »
      </span>
    </button>
  );
}
