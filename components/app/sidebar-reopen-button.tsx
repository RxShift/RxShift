"use client";

// Shown only while the sidebar is collapsed (CSS `.app-sidebar-reopen` in
// globals.css toggles display). Lives at the start of the page header — exactly
// where the collapse « sat — so it's obvious, and it never overlaps the banners.
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
      className="app-sidebar-reopen -ml-1 h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-steel transition-colors hover:bg-cloud hover:text-navy"
    >
      <span aria-hidden className="font-brand text-base font-bold leading-none">
        »
      </span>
    </button>
  );
}
