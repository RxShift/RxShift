import type { Metadata } from "next";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import ContactForm from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Nevada Pharmacy Compliance Scheduling | RxShift",
  description:
    "RxShift automates the hourly compliance documentation Nevada's proposed R113-24 requires. Built for Nevada pharmacies. Currently piloting in Las Vegas.",
};

const REQUIREMENTS = [
  {
    bold: "Maintain hourly documentation",
    rest: "naming each pharmacist and technician on duty",
  },
  {
    bold: "Log every deficient hour",
    rest: "when staffing falls below required minimums",
  },
  { bold: "Retain those records for two years", rest: "" },
  {
    bold: "Notify the Board",
    rest: "after three consecutive days of deficient staffing",
  },
];

const RULES_TABLE: [string, string, string][] = [
  ["Base ratio (non-hospital)", "1 RPh : 3 techs max", "Retained"],
  ["With trainees", "1 tech + 2 trainees max", "1 tech + 2 trainees max"],
  [
    "Volume minimum — pharmacists",
    "None",
    "2 RPhs at 20+ scripts/hr; +1 per additional 20/hr",
  ],
  [
    "Volume minimum — techs",
    "None",
    "1 tech at 5–9 scripts/hr; 2 at 10–19; 3 at 20+; +1 per additional 20/hr",
  ],
  ["Hourly documentation", "Not required", "Required — every shift"],
  ["Record retention", "Not specified", "2 years"],
  ["Board notification", "Not required", "After 3 consecutive deficient days"],
];

const SOLUTION_CARDS = [
  {
    eyebrow: "Ratio engine",
    heading: "Every shift, every rule applied.",
    body: "RxShift applies Nevada's pharmacist-to-tech ratio rules to every schedule you build — and flags any deficient half-hour before you publish, so the gap gets fixed on the screen instead of on the floor.",
  },
  {
    eyebrow: "Compliance Record",
    heading: "The R113-24 record, auto-generated.",
    body: "RxShift builds a timestamped hourly Compliance Record of what actually happened: pharmacist and tech names per hour, deficiency flags when coverage falls short, and an alert to your managers after three consecutive deficient days — the moment a board report may be required. It finalizes hour by hour from the published schedule and your team's live statuses, retained for two years and exportable on demand. RxShift never contacts the board; that decision stays inside your pharmacy.",
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
              Nevada&rsquo;s proposed staffing rule requires daily
              documentation. RxShift generates it automatically.
            </h1>
            <p className="mx-auto mt-5 max-w-[620px] font-body text-lg leading-[1.7] text-steel">
              Proposed rule R113-24 creates a daily documentation burden that
              spreadsheets and generic scheduling tools cannot meet. RxShift
              was built for exactly this.
            </p>
            <a
              href="#demo-form"
              className="mt-8 inline-block rounded-md bg-amber px-6 py-3 font-brand text-sm font-bold text-white transition-colors hover:bg-amber-dark"
            >
              Schedule a Walkthrough
            </a>
          </div>
        </section>

        {/* What R113-24 requires */}
        <section className="bg-cloud px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-[840px]">
            <p className="font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
              The rule
            </p>
            <h2 className="mt-3 font-brand text-[26px] font-bold text-navy sm:text-[30px]">
              The documentation requirement is the issue.
            </h2>
            <p className="mt-4 font-body text-base leading-[1.7] text-steel">
              Nevada&rsquo;s Board of Pharmacy has been advancing minimum
              staffing rules that go beyond ratio compliance. Under proposed
              R113-24, the managing pharmacist must:
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {REQUIREMENTS.map((r) => (
                <div
                  key={r.bold}
                  className="rounded-[10px] border-l-[3px] border-l-amber bg-white p-5 shadow-[0_1px_3px_rgba(28,47,94,0.08)]"
                >
                  <p className="font-body text-sm leading-[1.6] text-navy">
                    <strong>{r.bold}</strong>
                    {r.rest ? ` ${r.rest}` : ""}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-6 font-body text-base leading-[1.7] text-steel">
              This isn&rsquo;t a quarterly audit requirement. It&rsquo;s a
              daily operational burden — one that creates new administrative
              work on every shift, every day your pharmacy is open. A managing
              pharmacist running two shifts a day at a busy retail location is
              looking at 14 hourly log entries before the week is out.
            </p>
          </div>
        </section>

        {/* Rules table */}
        <section className="bg-white px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-[840px]">
            <p className="font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
              The rules
            </p>
            <h2 className="mt-3 font-brand text-[26px] font-bold text-navy sm:text-[30px]">
              Nevada&rsquo;s staffing requirements, current and proposed.
            </h2>
            <div className="mt-8 overflow-x-auto rounded-[10px] border border-line shadow-[0_1px_3px_rgba(28,47,94,0.08)]">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-cloud">
                    <th className="px-4 py-3 font-brand text-[11px] font-bold uppercase tracking-[0.5px] text-steel"></th>
                    <th className="px-4 py-3 font-brand text-[11px] font-bold uppercase tracking-[0.5px] text-steel">
                      Current (NAC 639.250)
                    </th>
                    <th className="px-4 py-3 font-brand text-[11px] font-bold uppercase tracking-[0.5px] text-navy">
                      Proposed R113-24
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {RULES_TABLE.map(([label, current, proposed]) => (
                    <tr key={label} className="border-t border-line">
                      <td className="px-4 py-3 font-body text-[13px] font-medium text-navy">
                        {label}
                      </td>
                      <td className="px-4 py-3 font-body text-[13px] text-steel">
                        {current}
                      </td>
                      <td className="px-4 py-3 font-body text-[13px] text-navy">
                        {proposed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 font-body text-[13px] leading-[1.7] text-steel">
              Source: NRS 639.1371, NAC 639.250, Proposed R113-24. R113-24 was
              noticed for hearing in 2025 and remains in active rulemaking.
              RxShift&rsquo;s documentation engine already produces the hourly
              records, the two-year retention, and the three-consecutive-day
              flag the rule&rsquo;s reporting requirement is built around —
              alerting <em>your managers</em>, never the board; any report is
              the pharmacy&rsquo;s decision to make. Volume-based staffing
              minimums are in active development.
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
                R113-24 doesn&rsquo;t ask for a schedule. It asks for a
                Compliance Record — a timestamped hourly record that accounts for
                every position, every hour, and every deficiency. Building
                that manually adds meaningful administrative time to every
                shift.
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
