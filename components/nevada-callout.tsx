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
            Proposed rule R113-24 changes everything about pharmacy staffing
            documentation.
          </h2>
          <p className="mt-6 max-w-[600px] font-body text-base leading-[1.7] text-white/80">
            Nevada&rsquo;s Board of Pharmacy has been advancing minimum staffing
            rules that would require managing pharmacists to maintain hourly
            documentation of every pharmacist and technician on duty — every
            shift, every day.
          </p>

          <div className="mt-8 max-w-[540px] rounded-lg bg-white/[0.06] p-5 text-left">
            <p className="font-body text-sm font-medium text-white">
              Under proposed R113-24:
            </p>
            <ul className="mt-3 space-y-2 font-body text-sm font-medium text-white">
              <li>• Hourly record naming each pharmacist and technician on duty</li>
              <li>• Every deficient hour logged</li>
              <li>• Records retained for 2 years</li>
              <li>• Board notification required after 3 consecutive deficient days</li>
            </ul>
          </div>

          <p className="mt-8 max-w-[600px] font-body text-base leading-[1.7] text-white/80">
            RxShift builds that Compliance Record automatically — finalized hour
            by hour from your published schedule and your team&rsquo;s live
            statuses. No extra steps. No new forms. No spreadsheet.
          </p>

          <p className="mt-8 font-body text-sm font-medium text-white/60">
            Currently piloting with Nevada pharmacies.{" "}
            <a href="/nevada" className="font-bold text-amber hover:underline">
              Read the full Nevada breakdown
            </a>{" "}
            or{" "}
            <a href="#demo" className="font-bold text-amber hover:underline">
              schedule a walkthrough
            </a>
            .
          </p>
        </div>

        {/* Right — the Compliance Record, the artifact R113-24 requires */}
        <div>
          <Image
            src="/images/screenshots/compliance-record.jpg"
            alt="RxShift Compliance Record: each pharmacist and technician on duty, by hour, with compliant status — the documentation R113-24 requires"
            width={1440}
            height={900}
            className="w-full rounded-lg ring-1 ring-white/15 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.55)]"
          />
        </div>
      </div>
    </section>
  );
}
