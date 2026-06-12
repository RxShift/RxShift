import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import ContactForm from "@/components/contact-form";
import PricingCalculator from "@/components/pricing-calculator";

export const metadata: Metadata = {
  title: "Pricing — RxShift",
  description:
    "Simple per-location pricing for pharmacies of any size. No setup fees, no compliance add-ons — everything is included at every tier.",
};

const INCLUDED: { heading: string; items: string[] }[] = [
  {
    heading: "Scheduling",
    items: [
      "Schedule generation",
      "Shift coverage management",
      "Time-off request handling",
      "Staff availability rules",
      "Pharmacist + tech role management",
    ],
  },
  {
    heading: "Compliance Engine",
    items: [
      "State ratio rules configuration",
      "Real-time pharmacist-to-tech ratio enforcement",
      "Deficiency flagging before you publish",
      "Live ratio board with one-tap status",
    ],
  },
  {
    heading: "Documentation",
    items: [
      "Automated hourly compliance log",
      "Deficiency flagging (per hour)",
      "3-consecutive-day deficiency alerts",
      "Board notification triggers",
      "2-year record retention",
      "Compliance export (board-ready format)",
    ],
  },
  {
    heading: "Management",
    items: [
      "Multi-location management (up to 25)",
      "Staff directory and offboarding",
      "Append-only audit trail",
      "Admin controls",
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero + calculator */}
        <section className="bg-white px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-[840px] text-center">
            <p className="font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
              Pricing
            </p>
            <h1 className="mt-4 font-brand text-3xl font-bold leading-tight tracking-[-0.3px] text-navy sm:text-4xl">
              Simple pricing for pharmacies of any size.
              <br className="hidden sm:block" /> No setup fees. No compliance
              add-ons.
            </h1>
            <p className="mx-auto mt-4 max-w-[560px] font-body text-lg leading-[1.7] text-steel">
              Per-location pricing that scales with your operation. Everything
              is included at every tier.
            </p>
          </div>
          <div className="mt-12">
            <PricingCalculator />
          </div>
          <p className="mt-10 text-center font-body text-sm text-steel">
            <Link
              href="/vs/when-i-work"
              className="font-medium text-navy underline-offset-2 hover:underline"
            >
              See how RxShift compares to generic scheduling tools →
            </Link>
          </p>
        </section>

        {/* What's included */}
        <section className="bg-cloud px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-[1040px]">
            <h2 className="text-center font-brand text-[26px] font-bold text-navy sm:text-[30px]">
              Everything included. One plan.
            </h2>
            <p className="mx-auto mt-3 max-w-[620px] text-center font-body text-[15px] leading-[1.7] text-steel">
              RxShift doesn&rsquo;t have tiers, add-ons, or compliance features
              locked behind a higher plan. Every pharmacy gets the full
              product.
            </p>
            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {INCLUDED.map((col) => (
                <div key={col.heading}>
                  <h3 className="font-brand text-sm font-bold text-navy">
                    {col.heading}
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {col.items.map((item) => (
                      <li
                        key={item}
                        className="flex gap-2 font-body text-[13px] leading-snug text-steel"
                      >
                        <span aria-hidden="true" className="font-bold text-[#2E7D5E]">
                          ✓
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-10 rounded-md bg-white px-5 py-4 text-center font-brand text-[13px] font-semibold text-steel">
              On the roadmap: Scripts-per-hour volume minimums (R113-24) ·
              Certified vs. non-certified tech tracking · Trainee supervision
              limits · Cert expiration tracking · PMS data import · Float pool
              scheduling · Volume forecasting · Additional state configurations
            </p>
          </div>
        </section>

        {/* Bottom CTA + lead form */}
        <ContactForm
          source="pricing-page"
          id="demo-form"
          heading="Ready to see it working?"
          body="We'll walk through your current scheduling process and show you how RxShift handles ratios, documentation, and compliance. About 20 minutes. Currently piloting in Nevada — pilot pricing available for early participants."
        />
      </main>
      <Footer />
    </>
  );
}
