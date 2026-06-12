import type { Metadata } from "next";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import ContactForm from "@/components/contact-form";

export const metadata: Metadata = {
  title: "California Pharmacy Ratio Compliance Scheduling | RxShift",
  description:
    "California's pharmacist-to-tech ratio rules are complex. RxShift is building BPC 4115's additive ratio model into the same engine that documents your staffing decisions.",
};

const RULES = [
  {
    bold: "The first pharmacist on duty may supervise up to 1 technician",
    rest: "",
  },
  {
    bold: "Each additional pharmacist adds supervision capacity for 2 more technicians",
    rest: "",
  },
  { bold: "Clerical staff are exempt", rest: "from ratio calculations" },
  {
    bold: "AB 1503 lets the pharmacist in charge set staffing levels",
    rest: "within these limits — but the rules still apply",
  },
];

export default function CaliforniaPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="bg-white px-6 py-16 sm:py-24">
          <div className="mx-auto max-w-[840px] text-center">
            <p className="font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
              California pharmacies
            </p>
            <h1 className="mt-4 font-brand text-3xl font-bold leading-tight tracking-[-0.3px] text-navy sm:text-4xl">
              California&rsquo;s ratio rules are more complex than most
              states. RxShift handles the math automatically.
            </h1>
            <p className="mx-auto mt-5 max-w-[620px] font-body text-lg leading-[1.7] text-steel">
              Under BPC 4115, each additional pharmacist on duty changes your
              supervision capacity. RxShift&rsquo;s ratio engine applies
              California&rsquo;s additive formula to every schedule you build,
              so you&rsquo;re always operating within the rules.
            </p>
          </div>
        </section>

        <section className="bg-cloud px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-[840px]">
            <p className="font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
              The rules
            </p>
            <h2 className="mt-3 font-brand text-[26px] font-bold text-navy sm:text-[30px]">
              How California&rsquo;s pharmacist-to-tech ratios work.
            </h2>
            <p className="mt-4 font-body text-base leading-[1.7] text-steel">
              California&rsquo;s ratio system is additive, not flat. Under
              Business and Professions Code 4115:
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
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
            <p className="mt-6 font-body text-base leading-[1.7] text-steel">
              In practice, this means your ratio changes with every pharmacist
              on the schedule. A shift with two pharmacists allows up to 3
              technicians. Three pharmacists allows up to 5. RxShift
              recalculates this automatically as you build the schedule — and
              flags any slot that breaks the formula before you publish.
            </p>
          </div>
        </section>

        <section className="bg-white px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-[840px]">
            <h2 className="font-brand text-[26px] font-bold text-navy sm:text-[30px]">
              What documentation matters in California.
            </h2>
            <div className="mt-4 space-y-4 font-body text-base leading-[1.7] text-steel">
              <p>
                California doesn&rsquo;t currently impose the same hourly
                documentation requirements Nevada is moving toward. But
                California boards can and do conduct compliance audits — and
                pharmacies that can demonstrate documented, ratio-compliant
                scheduling are in a significantly better position when they
                do.
              </p>
              <p>
                RxShift produces that documentation as a natural output of
                your published schedule.
              </p>
            </div>
          </div>
        </section>

        <ContactForm
          source="california-page"
          id="demo-form"
          heading="Managing a California pharmacy?"
          body="We'll walk through your scheduling workflow and show you BPC 4115's additive formula applied to a real schedule. About 20 minutes."
        />
      </main>
      <Footer />
    </>
  );
}
