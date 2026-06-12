import RxShiftMark from "./rxshift-mark";

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Security", href: "/security" },
    ],
  },
  {
    heading: "States",
    links: [
      { label: "Nevada", href: "/nevada" },
      { label: "California", href: "/states/california" },
      { label: "Tennessee", href: "/states/tennessee" },
    ],
  },
  {
    heading: "Resources",
    links: [{ label: "RxShift vs. When I Work", href: "/vs/when-i-work" }],
  },
  {
    heading: "Company",
    links: [
      { label: "Log in", href: "https://app.rxshift.io" },
      { label: "info@rxshift.io", href: "mailto:info@rxshift.io" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-navy px-6 py-12 lg:px-8">
      <div className="mx-auto max-w-[1120px]">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div>
            <RxShiftMark size={60} variant="dark" />
            <p className="mt-3 font-body text-[13px] text-white/50">
              Compliance-ready pharmacy scheduling
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-12">
            {COLUMNS.map((col) => (
              <div key={col.heading}>
                <p className="font-brand text-[10px] font-bold uppercase tracking-[1.5px] text-white/40">
                  {col.heading}
                </p>
                <ul className="mt-3 space-y-2">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <a
                        href={l.href}
                        className="font-body text-[13px] text-white/60 hover:text-white"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-10 border-t border-white/10 pt-6 font-body text-[12px] text-white/40">
          © 2026 RxShift · rxshift.io
        </p>
      </div>
    </footer>
  );
}
