import type { Metadata } from "next";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import ContactForm from "@/components/contact-form";

export const metadata: Metadata = {
  title: "RxShift vs. When I Work — Pharmacy Compliance Scheduling Comparison",
  description:
    "When I Work handles the calendar. RxShift handles the compliance. See how they compare for pharmacy scheduling, ratio enforcement, and documentation.",
};

type Mark = "yes" | "no" | "roadmap" | string;

const COMPARISON: [string, Mark, Mark][] = [
  ["Built for pharmacy", "✓ Pharmacy-specific", "✗ General workforce"],
  ["State ratio rules engine", "✓ Configurable per state", "✗ Not available"],
  ["Real-time ratio enforcement", "✓ Enforced during scheduling", "no"],
  ["Hourly compliance log generation", "✓ Auto-generated from schedule", "no"],
  ["Deficiency flagging per hour", "yes", "no"],
  ["3-day deficiency streak alerts (to your managers)", "yes", "no"],
  ["Compliance log export (.xlsx)", "yes", "no"],
  ["2-year record retention", "yes", "no"],
  ["Nevada compliance (NAC 639.250) + R113-24 documentation", "yes", "no"],
  ["California compliance (BPC 4115 additive formula)", "yes", "no"],
  ["Tech certification (CPhT) tracking", "yes", "no"],
  ["Trainee supervision limit tracking", "roadmap", "no"],
  ["Basic schedule building", "yes", "yes"],
  ["Time-off requests", "yes", "yes"],
  ["Staff management", "yes", "yes"],
  ["Designed for 1–25 locations", "yes", "yes"],
  ["Pharmacy-specific support", "yes", "no"],
];

function Cell({ value }: { value: Mark }) {
  if (value === "yes")
    return <span className="font-bold text-[#2E7D5E]">✓</span>;
  if (value === "no") return <span className="font-bold text-[#C0392B]">✗</span>;
  if (value === "roadmap")
    return (
      <span className="rounded-[4px] bg-amber/[0.12] px-1.5 py-0.5 font-brand text-[10px] font-bold uppercase text-amber">
        Roadmap
      </span>
    );
  const positive = value.startsWith("✓");
  return (
    <span
      className={`font-body text-[13px] font-medium ${positive ? "text-[#2E7D5E]" : "text-[#C0392B]"}`}
    >
      {value}
    </span>
  );
}

export default function VsWhenIWorkPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="bg-white px-6 py-16 sm:py-24">
          <div className="mx-auto max-w-[840px] text-center">
            <p className="font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
              RxShift vs. When I Work
            </p>
            <h1 className="mt-4 font-brand text-3xl font-bold leading-tight tracking-[-0.3px] text-navy sm:text-4xl">
              When I Work handles the calendar.
              <br className="hidden sm:block" /> RxShift handles the
              compliance.
            </h1>
            <p className="mx-auto mt-5 max-w-[640px] font-body text-lg leading-[1.7] text-steel">
              When I Work is a general-purpose scheduling tool built for
              restaurants, retail, and service businesses. It does not know
              your state&rsquo;s pharmacist-to-tech ratio rules, and it does
              not produce the compliance documentation your board may require.
              RxShift does both.
            </p>
          </div>
        </section>

        <section className="bg-cloud px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-[900px]">
            <div className="overflow-x-auto rounded-[10px] border border-line bg-white shadow-[0_1px_3px_rgba(28,47,94,0.08)]">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-cloud">
                    <th className="px-4 py-3 font-brand text-[11px] font-bold uppercase tracking-[0.5px] text-steel">
                      Feature
                    </th>
                    <th className="border-b-2 border-amber px-4 py-3 font-brand text-[11px] font-bold uppercase tracking-[0.5px] text-navy">
                      RxShift
                    </th>
                    <th className="px-4 py-3 font-brand text-[11px] font-bold uppercase tracking-[0.5px] text-steel">
                      When I Work
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map(([feature, rx, wiw]) => (
                    <tr key={feature} className="border-t border-line">
                      <td className="px-4 py-3 font-body text-[13px] font-medium text-navy">
                        {feature}
                      </td>
                      <td className="px-4 py-3">
                        <Cell value={rx} />
                      </td>
                      <td className="px-4 py-3">
                        <Cell value={wiw} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="bg-white px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-[840px]">
            <p className="font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
              The difference
            </p>
            <h2 className="mt-3 font-brand text-[26px] font-bold text-navy sm:text-[30px]">
              General scheduling is not compliance scheduling.
            </h2>
            <div className="mt-4 space-y-4 font-body text-base leading-[1.7] text-steel">
              <p>
                When I Work is a good product for businesses where scheduling
                is purely a logistics problem. For restaurants, retail stores,
                and service businesses with no regulatory requirements, it
                does the job well.
              </p>
              <p>
                Pharmacy isn&rsquo;t that category. Your state likely requires
                documented proof that every shift ran at the right
                pharmacist-to-tech ratio. Some states are moving toward daily
                hourly logging. When that documentation doesn&rsquo;t exist,
                the exposure sits with your managing pharmacist personally —
                not your software vendor.
              </p>
              <p>
                RxShift wasn&rsquo;t built to compete with When I Work on
                general scheduling features. It was built to close the
                compliance gap that general scheduling tools cannot fill.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-cloud px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-[840px]">
            <p className="font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
              Switching
            </p>
            <h2 className="mt-3 font-brand text-[26px] font-bold text-navy sm:text-[30px]">
              The transition is straightforward.
            </h2>
            <div className="mt-4 space-y-4 font-body text-base leading-[1.7] text-steel">
              <p>
                RxShift handles schedule generation, time-off requests, and
                staff availability — everything When I Work does for your
                pharmacy — plus the compliance layer it doesn&rsquo;t.
              </p>
              <p>
                Your staff learns one tool. Your managing pharmacist stops
                maintaining a separate spreadsheet for documentation. Your
                compliance record generates itself.
              </p>
            </div>
          </div>
        </section>

        <ContactForm
          source="vs-when-i-work"
          id="demo-form"
          heading="See the compliance layer working."
          body="We'll walk through your current scheduling process and show you what RxShift adds. About 20 minutes."
        />
      </main>
      <Footer />
    </>
  );
}
