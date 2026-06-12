import type { Metadata } from "next";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import ContactForm from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Tennessee Pharmacy Ratio Compliance Scheduling | RxShift",
  description:
    "Tennessee requires 1:2 base pharmacist-to-tech ratios, expandable with certified techs. RxShift is building certification-mix tracking into the same compliance engine.",
};

const RULES = [
  { bold: "Base ratio: 1 pharmacist to 2 technicians", rest: "" },
  {
    bold: "With board-certified technicians: expandable to 1 pharmacist to 4 technicians",
    rest: "(board approval required)",
  },
  {
    bold: "Mix matters:",
    rest: "if your shift has both certified and non-certified techs, the lower ratio applies",
  },
];

export default function TennesseePage() {
  return (
    <>
      <Nav />
      <main>
        <section className="bg-white px-6 py-16 sm:py-24">
          <div className="mx-auto max-w-[840px] text-center">
            <p className="font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
              Tennessee pharmacies
            </p>
            <h1 className="mt-4 font-brand text-3xl font-bold leading-tight tracking-[-0.3px] text-navy sm:text-4xl">
              Tennessee&rsquo;s ratio rules depend on your tech certification
              mix.
            </h1>
            <p className="mx-auto mt-5 max-w-[620px] font-body text-lg leading-[1.7] text-steel">
              A base 1:2 ratio expands to 1:4 when your technicians are
              board-certified. RxShift&rsquo;s Tennessee configuration —
              tracking the certification mix and applying the right rule to
              every shift — is in active development.
            </p>
          </div>
        </section>

        <section className="bg-cloud px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-[840px]">
            <p className="font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
              The rules
            </p>
            <h2 className="mt-3 font-brand text-[26px] font-bold text-navy sm:text-[30px]">
              How Tennessee&rsquo;s pharmacist-to-tech ratios work.
            </h2>
            <div className="mt-6 grid gap-3">
              {RULES.map((r) => (
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
            <div className="mt-6 space-y-4 font-body text-base leading-[1.7] text-steel">
              <p>
                Tennessee&rsquo;s ratio system means your compliance posture
                can change shift to shift based on which technicians are
                scheduled. A shift where your certified techs have the day off
                may require an additional pharmacist to stay compliant.
              </p>
              <p>
                That&rsquo;s a certification-aware calculation — and
                it&rsquo;s on RxShift&rsquo;s near-term roadmap. Today,
                RxShift enforces your configured ratio on every shift and
                flags non-compliant slots before they&rsquo;re published;
                certification-mix tracking extends the same engine.
              </p>
            </div>
          </div>
        </section>

        <ContactForm
          source="tennessee-page"
          id="demo-form"
          heading="Managing a Tennessee pharmacy?"
          body="We'd like to understand your scheduling workflow as we build Tennessee's configuration. Schedule a 20-minute conversation."
        />
      </main>
      <Footer />
    </>
  );
}
