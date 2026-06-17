// A lightweight "app in a browser" frame for marketing screenshots: navy
// header bar with macOS-style dots and a faint URL pill, rounded, drop shadow.
export default function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-[0_24px_60px_-15px_rgba(28,47,94,0.35)]">
      <div className="flex items-center gap-1.5 border-b border-white/10 bg-navy px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
        <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
        <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        <span className="ml-3 hidden flex-1 rounded bg-white/10 px-3 py-1 font-body text-[11px] text-white/50 sm:block">
          app.rxshift.io
        </span>
      </div>
      {children}
    </div>
  );
}
