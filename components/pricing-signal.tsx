import Link from "next/link";

export default function PricingSignal() {
  return (
    <section className="bg-white px-6 py-12 sm:py-[72px]">
      <div className="mx-auto max-w-[680px] text-center">
        <p className="font-brand text-[10px] font-bold uppercase tracking-[1.8px] text-amber">
          Pricing
        </p>
        <h2 className="mt-4 font-brand text-2xl font-bold leading-snug text-navy sm:text-[28px]">
          Built for your size.
          <br className="hidden sm:block" /> Not enterprise software.
        </h2>
        <p className="mx-auto mt-6 max-w-[600px] font-body text-base leading-[1.7] text-steel">
          RxShift is priced per location, per month — with no setup fee and no
          long-term contract required to get started. Volume pricing is
          available for groups of 5+ locations.
        </p>

        <div className="mt-8 space-y-3 border-y border-line py-6 font-body text-[15px] font-medium text-steel">
          <p>When I Work doesn&rsquo;t know your state&rsquo;s ratio rules.</p>
          <p>
            Legion&rsquo;s implementation alone runs five to fifty thousand
            dollars.
          </p>
          <p>
            RxShift is built specifically for pharmacies your size — without
            the enterprise price tag.
          </p>
        </div>

        <p className="mt-6 font-body text-[13px] text-alert">
          We&rsquo;re currently piloting with Nevada pharmacies.
          <br className="hidden sm:block" /> Pilot participants receive early
          pricing. Talk to us before rates are published.
        </p>

        <p className="mt-6">
          <Link
            href="/pricing"
            className="font-body text-sm font-medium text-navy underline-offset-4 hover:underline"
          >
            See pricing details →
          </Link>
        </p>
      </div>
    </section>
  );
}
