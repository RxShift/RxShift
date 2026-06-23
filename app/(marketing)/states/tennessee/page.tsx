import type { Metadata } from "next";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import ContactForm from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Tennessee Pharmacy Ratio Compliance Scheduling | RxShift",
  description:
    "Tennessee caps non-certified technicians at 6 per pharmacist; certified (CPhT) technicians are uncapped. RxShift tracks your certification mix and enforces the right ratio on every shift.",
};

const RULES = [
  {
    bold: "Non-certified technicians:",
    rest: "your pharmacist may supervise up to 6 at a time",
  },
  {
    bold: "Certified technicians (CPhT / NHA ExCPT):",
    rest: "can be added beyond the 6 non-certified cap with no fixed limit",
  },
  {
    bold: "Tracking your techs' certification status",
    rest: "is how RxShift manages this calculation",
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
              Tennessee caps non-certified techs at 6 per pharmacist and lifts
              that cap for certified technicians. RxShift&rsquo;s Tennessee
              configuration tracks your certification mix and enforces the right
              rule on every shift.
            </p>
          </div>
        </section>

        <section className="bg-cloud px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-[840px]">
            <p className="font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
              The rules
            </p>
            <h2 className="mt-3 font-brand text-[26px] font-bold text-navy sm:text-[30px]">
              How Tennessee&rsquo;s pharmacist-to-tech ratio works.
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
                Tennessee&rsquo;s rule means your compliance posture depends on
                who is scheduled: one pharmacist can oversee up to six
                non-certified technicians, and certified technicians don&rsquo;t
                count against that cap at all. Swap a certified tech for a
                non-certified one and your headroom changes.
              </p>
              <p>
                RxShift tracks each technician&rsquo;s certification status and
                applies the right cap to every shift — flagging any slot that
                exceeds six non-certified technicians per pharmacist before you
                publish. Certified technicians are counted separately and never
                against the cap.
              </p>
            </div>
            <p className="mt-6 font-body text-[13px] leading-[1.7] text-steel">
              Source: Tenn. Comp. R. &amp; Regs. 1140-02-.02. Always verify
              against the Tennessee Board of Pharmacy&rsquo;s current language
              before relying on it.
            </p>
          </div>
        </section>

        <ContactForm
          source="tennessee-page"
          id="demo-form"
          heading="Managing a Tennessee pharmacy?"
          body="See how RxShift tracks your certification mix and enforces Tennessee's ratio on every shift. Schedule a 20-minute demo."
        />
      </main>
      <Footer />
    </>
  );
}
