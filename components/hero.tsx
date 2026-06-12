export default function Hero() {
  return (
    <section className="px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-[720px] text-center">
        <h1 className="font-brand text-4xl font-bold leading-tight tracking-[-0.3px] text-navy sm:text-5xl">
          Your schedule knows the ratios.
          <br />
          So you don&rsquo;t have to.
        </h1>
        <p className="mx-auto mt-6 max-w-[540px] font-body text-lg leading-[1.7] text-steel">
          RxShift generates compliant pharmacy schedules automatically —
          tracking pharmacist-to-tech ratios, producing the hourly
          documentation regulators require, and handling the staffing math
          that spreadsheets get wrong.
        </p>
        <div className="mt-8">
          <a
            href="#demo"
            className="inline-block rounded-md bg-amber px-6 py-3 font-brand text-sm font-bold text-white transition-colors hover:bg-amber-dark"
          >
            Schedule a Demo
          </a>
          <p className="mt-4 font-body text-[13px] text-steel">
            Piloting now with Nevada pharmacies.
          </p>
        </div>
      </div>
    </section>
  );
}
