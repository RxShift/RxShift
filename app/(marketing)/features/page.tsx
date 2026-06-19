import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/nav";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: "Features — RxShift",
  description:
    "Ratio-aware scheduling, an automated hourly Compliance Record, and pricing designed for independent and regional pharmacies.",
};

const SECTIONS = [
  {
    heading: "Ratio-aware scheduling",
    body: "RxShift applies your state's pharmacist-to-tech ratio rules to every shift as you build it. Certified, non-certified, trainee, and intern counts are tracked separately because the math is different for each — and most states require it.",
  },
  {
    heading: "An automated Compliance Record",
    body: "RxShift builds a timestamped hourly Compliance Record of what actually happened — the pharmacist and each technician on duty per hour, deficiency flags when coverage falls short, and automatic notification triggers for extended deficiencies. It finalizes hour by hour from the published schedule and your team's live statuses; the record is retained two years and exportable on demand. (A separate Coverage Forecast projects the schedule for planning.)",
  },
  {
    heading: "Designed for small groups, not enterprises",
    body: "No implementation project. No dedicated IT. RxShift is configured for your locations, your state rules, and your staff in under an hour. Pricing is per location per month — not per employee, not per feature tier.",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <Nav />
      <main className="flex-1 px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-[680px]">
          <p className="font-brand text-[10px] font-bold uppercase tracking-[1.8px] text-amber">
            How it works
          </p>
          <h1 className="mt-4 font-brand text-3xl font-bold tracking-[-0.3px] text-navy sm:text-4xl">
            Everything your pharmacy schedule needs to be compliant.
          </h1>

          <div className="mt-12 space-y-10">
            {SECTIONS.map((s) => (
              <section key={s.heading}>
                <h2 className="font-brand text-xl font-bold text-navy">
                  {s.heading}
                </h2>
                <p className="mt-3 font-body text-base leading-[1.7] text-steel">
                  {s.body}
                </p>
              </section>
            ))}
          </div>

          <Link
            href="/#demo"
            className="mt-12 inline-block rounded-md bg-amber px-6 py-3 font-brand text-sm font-bold text-white transition-colors hover:bg-amber-dark"
          >
            See it working — Schedule a Demo
          </Link>

          <p className="mt-8 font-body text-[13px] text-steel">
            Have a specific workflow question? Email us at{" "}
            <a href="mailto:info@rxshift.io" className="underline">
              info@rxshift.io
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
