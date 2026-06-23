import Image from "next/image";

export default function NevadaCallout() {
  return (
    <section className="bg-navy px-6 py-12 sm:py-20">
      <div className="mx-auto grid max-w-[1120px] items-center gap-10 lg:grid-cols-[1fr_0.85fr] lg:gap-14">
        {/* Left — copy + bullets (unchanged) */}
        <div className="text-center lg:text-left">
          <p className="font-brand text-[10px] font-bold uppercase tracking-[1.8px] text-amber">
            If you&rsquo;re in Nevada, this matters now
          </p>
          <h2 className="mt-4 font-brand text-[26px] font-bold leading-snug text-white sm:text-[32px]">
            Nevada requires documented compliance. RxShift generates the record
            automatically.
          </h2>
          <p className="mt-6 max-w-[600px] font-body text-base leading-[1.7] text-white/80">
            Nevada law (NAC 639.250) sets strict pharmacist-to-tech ratio caps.
            RxShift enforces them on every shift you build — flagging violations
            before you publish, not after an inspector arrives.
          </p>

          <div className="mt-8 max-w-[540px] rounded-lg bg-white/[0.06] p-5 text-left">
            <p className="font-body text-sm font-medium text-white">
              Every published schedule gives you:
            </p>
            <ul className="mt-3 space-y-2 font-body text-sm font-medium text-white">
              <li>• Ratio caps enforced on every shift, flagged before publish</li>
              <li>• A timestamped hourly record of who staffed each hour</li>
              <li>• Deficiency flags and a 2-year retained, export-ready log</li>
              <li>• An inspection-ready export, on demand</li>
            </ul>
          </div>

          <p className="mt-8 max-w-[600px] font-body text-base leading-[1.7] text-white/80">
            We&rsquo;re tracking proposed rule R072-25, which had a public
            hearing in June 2026. It&rsquo;s not yet adopted — when it passes,
            RxShift will update automatically. No extra steps. No new forms. No
            spreadsheet.
          </p>

          <p className="mt-8 font-body text-sm font-medium text-white/60">
            Currently piloting with Nevada pharmacies.{" "}
            <a href="/nevada" className="font-bold text-amber hover:underline">
              Read the full Nevada breakdown
            </a>{" "}
            or{" "}
            <a href="#demo" className="font-bold text-amber hover:underline">
              schedule a demo
            </a>
            .
          </p>
        </div>

        {/* Right — the Compliance Record (the inspection-ready artifact) */}
        <div>
          <Image
            src="/images/screenshots/compliance-record.jpg"
            alt="RxShift Compliance Record: each pharmacist and technician on duty, by hour, with compliant status — an inspection-ready record"
            width={1440}
            height={900}
            className="w-full rounded-lg ring-1 ring-white/15 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.55)]"
          />
        </div>
      </div>
    </section>
  );
}
