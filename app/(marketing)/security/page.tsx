import type { Metadata } from "next";
import Nav from "@/components/nav";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: "Security — RxShift",
  description:
    "How RxShift protects pharmacy scheduling data: data minimization, tenant isolation, encryption, and audit logging.",
};

const SECTIONS = [
  {
    heading: "We hold less data on purpose",
    body: "RxShift stores names, work emails, schedules, and staffing records — and deliberately nothing else. No patient information of any kind. No prescription data. No compensation or payroll data. No professional credential documents. A scheduling tool doesn't need them, so we don't collect them.",
  },
  {
    heading: "Every pharmacy's data is isolated",
    body: "RxShift is multi-tenant with row-level isolation enforced in the database itself — every query is scoped to your organization at the data layer, not just in application code. Your schedules, staff, and compliance records are never visible to another customer.",
  },
  {
    heading: "Encrypted in transit and at rest",
    body: "All traffic uses TLS. Data is encrypted at rest on infrastructure from established providers (Vercel and Supabase, on AWS). Secrets and API keys live server-side only and are never exposed to the browser.",
  },
  {
    heading: "Passwordless sign-in",
    body: "RxShift uses magic-link email authentication — there are no passwords to reuse, phish, or leak. Sessions are short-lived and renewed automatically. Sign-in is rate-limited.",
  },
  {
    heading: "Everything is logged",
    body: "Schedule changes, approvals, role changes, and every overridden compliance warning are recorded in an append-only activity log — who, what, and when. Compliance records are retained for two years and exportable on demand.",
  },
  {
    heading: "AI that proposes, never decides",
    body: "RxShift's AI features run server-side and assist with drafting and explanation only. Ratio and hours compliance is always computed by deterministic logic, and a person confirms any change that affects compliance. AI never silently decides a ratio.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <Nav />
      <main className="flex-1 px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-[680px]">
          <p className="font-brand text-[10px] font-bold uppercase tracking-[1.8px] text-amber">
            Security
          </p>
          <h1 className="mt-4 font-brand text-3xl font-bold tracking-[-0.3px] text-navy sm:text-4xl">
            Built like the records depend on it. Because they do.
          </h1>
          <p className="mt-5 font-body text-base leading-[1.7] text-steel">
            Pharmacies run vendor security reviews, and they should. Here is
            RxShift&rsquo;s posture in plain terms. Customers get fuller
            technical detail in-app.
          </p>

          <div className="mt-10 space-y-8">
            {SECTIONS.map((s) => (
              <section key={s.heading}>
                <h2 className="font-brand text-lg font-bold text-navy">
                  {s.heading}
                </h2>
                <p className="mt-2 font-body text-[15px] leading-[1.7] text-steel">
                  {s.body}
                </p>
              </section>
            ))}
          </div>

          <p className="mt-12 border-t border-line pt-6 font-body text-[13px] text-steel">
            Questions from your security review? Email{" "}
            <a href="mailto:info@rxshift.io" className="underline">
              info@rxshift.io
            </a>{" "}
            and we&rsquo;ll answer directly.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
