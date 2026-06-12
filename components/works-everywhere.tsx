const STATS = [
  { stat: "~24 states", label: "No fixed ratio" },
  { stat: "~18 states", label: "Hard ratio rules" },
  { stat: "All states", label: "Documentation matters" },
];

export default function WorksEverywhere() {
  return (
    <section className="bg-cloud px-6 py-12 sm:py-[72px]">
      <div className="mx-auto max-w-[720px] text-center">
        <p className="font-brand text-[10px] font-bold uppercase tracking-[1.8px] text-amber">
          All 50 states
        </p>
        <h2 className="mt-4 font-brand text-2xl font-bold leading-snug text-navy sm:text-[28px]">
          Most states don&rsquo;t have fixed ratios.
          <br className="hidden sm:block" /> Every state expects documented
          judgment.
        </h2>
        <div className="mx-auto mt-6 max-w-[620px] space-y-4 font-body text-base leading-[1.7] text-steel">
          <p>
            In states without hard ratio rules, pharmacy boards still expect
            pharmacists in charge to document that staffing decisions were made
            professionally — and to defend them if challenged.
          </p>
          <p>
            RxShift produces that record too. Whether you&rsquo;re navigating
            Nevada&rsquo;s ratios or Arizona&rsquo;s professional-judgment
            standard, your staffing decisions are documented, timestamped, and
            exportable.
          </p>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-8 sm:flex-row sm:gap-16">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="font-brand text-[28px] font-bold text-navy">
                {s.stat}
              </p>
              <p className="mt-1 font-body text-xs text-steel">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
