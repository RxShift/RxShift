export default function NevadaCallout() {
  return (
    <section className="bg-navy px-6 py-12 sm:py-20">
      <div className="mx-auto max-w-[720px] text-center">
        <p className="font-brand text-[10px] font-bold uppercase tracking-[1.8px] text-amber">
          If you&rsquo;re in Nevada, this matters now
        </p>
        <h2 className="mt-4 font-brand text-[26px] font-bold leading-snug text-white sm:text-[32px]">
          Proposed rule R113-24 changes everything
          <br className="hidden sm:block" /> about pharmacy staffing
          documentation.
        </h2>
        <p className="mx-auto mt-6 max-w-[600px] font-body text-base leading-[1.7] text-white/80">
          Nevada&rsquo;s Board of Pharmacy has been advancing minimum staffing
          rules that would require managing pharmacists to maintain hourly
          documentation of every pharmacist and technician on duty — every
          shift, every day.
        </p>

        <div className="mx-auto mt-8 max-w-[540px] rounded-lg bg-white/[0.06] p-5 text-left">
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

        <p className="mx-auto mt-8 max-w-[600px] font-body text-base leading-[1.7] text-white/80">
          RxShift generates that record automatically from every published
          schedule. No extra steps. No new forms. Done before the shift starts.
        </p>

        <p className="mt-8 font-body text-sm font-medium text-white/60">
          Currently piloting with Nevada pharmacies. Questions about how
          R113-24 affects your operation?{" "}
          <a
            href="#demo"
            className="font-bold text-amber hover:underline"
          >
            Schedule a demo
          </a>
        </p>
      </div>
    </section>
  );
}
