export default function Problem() {
  return (
    <section className="bg-white px-6 py-12">
      <div className="mx-auto max-w-[680px] space-y-6">
        <p className="font-brand text-lg font-medium leading-relaxed text-navy">
          Pharmacy scheduling isn&rsquo;t like other scheduling. Your state has
          ratio rules. Those ratios depend on whether your techs are certified,
          non-certified, or trainees — and the math changes when volumes shift.
        </p>
        <p className="font-brand text-lg font-medium leading-relaxed text-navy">
          Generic scheduling tools don&rsquo;t know any of this. Excel
          doesn&rsquo;t flag when you&rsquo;re about to run a shift one tech
          short of compliant.
        </p>
        <p className="font-brand text-lg font-bold leading-relaxed text-navy">
          RxShift does.
        </p>
        <p className="font-brand text-lg font-bold leading-relaxed text-amber">
          Built for pharmacists, by a pharmacist.
        </p>
      </div>
    </section>
  );
}
