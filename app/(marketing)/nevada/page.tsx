import type { Metadata } from "next";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import ContactForm from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Nevada Pharmacy Compliance Scheduling | RxShift",
  description:
    "RxShift enforces Nevada's pharmacist-to-tech ratio caps (NAC 639.250) on every shift and auto-generates a timestamped compliance record for Board inspections. Built for Nevada pharmacies. Currently piloting in Las Vegas.",
};

// Current law (NAC 639.250) vs the PROPOSED rule R072-25 (public hearing June
// 2026, not adopted). Only the current column is enforced today; R072-25 is
// forward context, applied automatically if/when it's adopted.
const RULES_TABLE: [string, string, string][] = [
  [
    "Retail ratio cap",
    "1 pharmacist : 3 technicians",
    "1 pharmacist : 4 technicians (or 2 techs + 2 trainees)",
  ],
  ["Telepharmacy / remote / satellite", "1 : 3", "1 : 3 (unchanged)"],
  [
    "Solo-pharmacist staffing floor",
    "Not specified",
    "≥1 support staff on duty (≥2 with a drive-through)",
  ],
  [
    "Technicians in training",
    "1 tech + 2 trainees",
    "2 techs + 2 trainees per pharmacist",
  ],
  [
    "Daily prescription volume",
    "Not specified",
    "Volume thresholds (RxShift records the figure; never enforces a minimum)",
  ],
  ["Record retention", "2 years (NAC 639.744)", "2 years"],
];

const SOLUTION_CARDS = [
  {
    eyebrow: "Ratio engine",
    heading: "Every shift, every rule applied.",
    body: "RxShift applies Nevada's pharmacist-to-tech ratio caps (NAC 639.250) to every schedule you build — and flags any deficient half-hour before you publish, so the gap gets fixed on the screen instead of on the floor.",
  },
  {
    eyebrow: "Compliance Record",
    heading: "A timestamped record, auto-generated.",
    body: "Every published schedule produces a timestamped hourly Compliance Record: who staffed the pharmacy each hour, deficiency flags when coverage falls short, and an export-ready log for Board inspections. It finalizes hour by hour from the schedule and your team's live statuses, retained two years. If deficient hours run several days in a row, RxShift alerts your own managers — it never contacts the board; that call stays inside your pharmacy.",
  },
  {
    eyebrow: "Zero extra work",
    heading: "Nothing new to do after you schedule.",
    body: "The Compliance Record comes out of the schedule you were already building. No separate logging. No end-of-day forms. No spreadsheet to fill in. Publish the schedule, keep your team's statuses current, and RxShift finalizes the record hour by hour.",
  },
];

export default function NevadaPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="bg-white px-6 py-16 sm:py-24">
          <div className="mx-auto max-w-[840px] text-center">
            <p className="font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
              Nevada pharmacies
            </p>
            <h1 className="mt-4 font-brand text-3xl font-bold leading-tight tracking-[-0.3px] text-navy sm:text-4xl">
              Nevada requires documented compliance. RxShift generates the
              record automatically.
            </h1>
            <p className="mx-auto mt-5 max-w-[620px] font-body text-lg leading-[1.7] text-steel">
              Nevada law (NAC 639.250) sets strict pharmacist-to-tech ratio
              caps. RxShift enforces them on every shift you build — flagging
              violations before you publish, not after an inspector arrives.
            </p>
            <a
              href="#demo-form"
              className="mt-8 inline-block rounded-md bg-amber px-6 py-3 font-brand text-sm font-bold text-white transition-colors hover:bg-amber-dark"
            >
              Schedule a Demo
            </a>
          </div>
        </section>

        {/* What RxShift does with current law */}
        <section className="bg-cloud px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-[840px]">
            <p className="font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
              How it works
            </p>
            <h2 className="mt-3 font-brand text-[26px] font-bold text-navy sm:text-[30px]">
              Current law, enforced on every shift.
            </h2>
            <div className="mt-4 space-y-4 font-body text-base leading-[1.7] text-steel">
              <p>
                Nevada law (NAC 639.250) sets strict pharmacist-to-tech ratio
                caps. RxShift enforces them on every shift you build — flagging
                violations before you publish, not after an inspector arrives.
              </p>
              <p>
                Every published schedule produces a timestamped compliance
                record: who staffed the pharmacy each hour, deficiency flags,
                and an export-ready log for Board inspections.
              </p>
              <p>
                We&rsquo;re tracking proposed rule{" "}
                <strong className="text-navy">R072-25</strong>, which had a
                public hearing in June 2026. It is not yet adopted — when it
                passes, RxShift will update automatically. You can preview it
                today by turning it on in Settings.
              </p>
            </div>
          </div>
        </section>

        {/* Rules table */}
        <section className="bg-white px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-[840px]">
            <p className="font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
              The rules
            </p>
            <h2 className="mt-3 font-brand text-[26px] font-bold text-navy sm:text-[30px]">
              Nevada&rsquo;s staffing rules, current and proposed.
            </h2>
            <div className="mt-8 overflow-x-auto rounded-[10px] border border-line shadow-[0_1px_3px_rgba(28,47,94,0.08)]">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-cloud">
                    <th className="px-4 py-3 font-brand text-[11px] font-bold uppercase tracking-[0.5px] text-steel"></th>
                    <th className="px-4 py-3 font-brand text-[11px] font-bold uppercase tracking-[0.5px] text-navy">
                      Current — NAC 639.250 (enforced)
                    </th>
                    <th className="px-4 py-3 font-brand text-[11px] font-bold uppercase tracking-[0.5px] text-steel">
                      Proposed — R072-25 (not adopted)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {RULES_TABLE.map(([label, current, proposed]) => (
                    <tr key={label} className="border-t border-line">
                      <td className="px-4 py-3 font-body text-[13px] font-medium text-navy">
                        {label}
                      </td>
                      <td className="px-4 py-3 font-body text-[13px] text-navy">
                        {current}
                      </td>
                      <td className="px-4 py-3 font-body text-[13px] text-steel">
                        {proposed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 font-body text-[13px] leading-[1.7] text-steel">
              Source: NRS 639.1371 and NAC 639.250 (current, enforced), plus
              proposed rule R072-25. R072-25 had its public hearing in June 2026
              and is <em>not yet adopted</em>. RxShift enforces current law
              today; the moment R072-25 is adopted, RxShift will apply it
              automatically — or you can preview it now with a single toggle in
              Settings. RxShift records expected prescription volume for
              planning but never enforces a volume minimum.
            </p>
          </div>
        </section>

        {/* Why generic tools fail */}
        <section className="bg-cloud px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-[840px]">
            <p className="font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
              The problem
            </p>
            <h2 className="mt-3 font-brand text-[26px] font-bold text-navy sm:text-[30px]">
              A schedule is not a Compliance Record.
            </h2>
            <div className="mt-4 space-y-4 font-body text-base leading-[1.7] text-steel">
              <p>
                Generic scheduling tools track who&rsquo;s on shift. They
                don&rsquo;t know your pharmacist-to-tech ratio, which roles
                count toward it, or that Nevada&rsquo;s supervision rules
                differ between hospital and non-hospital settings.
              </p>
              <p>
                A Board inspection asks for more than a schedule — it asks for a
                timestamped hourly record that accounts for every position,
                every hour, and every deficiency. Building that by hand adds
                meaningful administrative time to every shift.
              </p>
              <p>
                When a board inspector requests documentation, &ldquo;we use{" "}
                <a
                  href="/vs/when-i-work"
                  className="font-medium text-navy underline-offset-2 hover:underline"
                >
                  When I Work
                </a>
                &rdquo; is not an answer.
              </p>
            </div>
          </div>
        </section>

        {/* How RxShift handles it */}
        <section className="bg-white px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-[1040px]">
            <p className="text-center font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
              The solution
            </p>
            <h2 className="mx-auto mt-3 max-w-[680px] text-center font-brand text-[26px] font-bold leading-snug text-navy sm:text-[28px]">
              Publish the schedule, and the Compliance Record writes itself —
              hour by hour.
            </h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {SOLUTION_CARDS.map((c) => (
                <div
                  key={c.eyebrow}
                  className="rounded-[10px] border border-line bg-white p-7 shadow-[0_1px_3px_rgba(28,47,94,0.08)]"
                >
                  <p className="font-brand text-[10px] font-bold uppercase tracking-[1.8px] text-amber">
                    {c.eyebrow}
                  </p>
                  <h3 className="mb-2 mt-3 font-brand text-lg font-bold text-navy">
                    {c.heading}
                  </h3>
                  <p className="font-body text-sm leading-[1.65] text-steel">
                    {c.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pilot */}
        <section className="bg-navy px-6 py-14 sm:py-16">
          <div className="mx-auto max-w-[680px] text-center">
            <h2 className="font-brand text-[26px] font-bold text-white">
              Currently piloting with Nevada pharmacies.
            </h2>
            <p className="mt-4 font-body text-base leading-[1.7] text-white/80">
              RxShift is actively piloting with Optum-affiliated and
              independent pharmacies in the Las Vegas area. Nevada pharmacies
              that join during the pilot period receive early access pricing.
            </p>
          </div>
        </section>

        {/* Lead form */}
        <ContactForm
          source="nevada-page"
          id="demo-form"
          heading="See it working in your pharmacy."
          body="We'll walk through your current scheduling process and show you how RxShift handles Nevada's requirements. About 20 minutes."
        />
      </main>
      <Footer />
    </>
  );
}
