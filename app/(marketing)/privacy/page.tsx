import type { Metadata } from "next";
import Nav from "@/components/nav";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: "Privacy Policy — RxShift",
  description: "How RxShift collects, uses, and protects personal data.",
  robots: { index: false },
};

const SECTIONS: { heading: string; paragraphs: string[] }[] = [
  {
    heading: "1. Who this covers",
    paragraphs: [
      "Three groups interact with RxShift: Visitors (people browsing rxshift.io or submitting our contact forms), Customers (pharmacies that subscribe), and Staff Users (pharmacy staff whose information a Customer puts into the Service).",
      "This distinction matters: for Visitor data, RxShift decides how data is used — we are the “controller.” For Customer and Staff User data inside the Service (rosters, schedules, Compliance Records), the PHARMACY decides — we process that data only on the Customer's behalf and instructions. Staff Users should direct privacy requests about their roster data to their pharmacy; we support the pharmacy in fulfilling them.",
    ],
  },
  {
    heading: "2. What we collect, and why",
    paragraphs: [
      "Visitors: name, pharmacy name, state, email, and any message you submit through a demo-request form — used solely to respond to your inquiry and track our own sales pipeline. We do not buy lists or load cold contacts.",
      "Customers and Staff Users: account emails (used only to deliver one-time sign-in links — RxShift stores no passwords), staff names, job titles, certification status, employment type, schedules, time-off and callout records, ratio configuration, Compliance Records, and an audit trail of actions taken in the Service. This is the data the product exists to manage.",
      "Automatically: standard server logs (IP address, browser, pages) for security and reliability. We do not run third-party advertising trackers.",
    ],
  },
  {
    heading: "3. What we deliberately do NOT collect",
    paragraphs: [
      "RxShift is designed not to receive protected health information: no patient data, no prescription data, no medical records. We also do not collect payroll or compensation data, or credential documents.",
    ],
  },
  {
    heading: "4. Subprocessors",
    paragraphs: [
      "We use a small set of infrastructure providers to run the Service: Supabase (database and authentication, hosted in the United States), Vercel (application hosting), Resend (transactional email), and OpenAI (server-side processing of scheduling-assistant requests; schedule context is sent for processing, never used by us for advertising). Each processes data only to provide its service to us.",
    ],
  },
  {
    heading: "5. Retention",
    paragraphs: [
      "Compliance records are retained for the regulatory retention window (currently two years) — that retention is a product feature pharmacies rely on. Other Customer Data is deleted within 60 days of subscription termination, and Customers may export their data at any time. Visitor (lead) records are kept while relevant to our sales relationship and deleted on request.",
    ],
  },
  {
    heading: "6. Security",
    paragraphs: [
      "Tenant data is isolated with database row-level security; access is passwordless (one-time emailed links); all traffic is encrypted in transit and data is encrypted at rest; an append-only audit log records material actions. Full detail is published on our security page and, for Customers, on the in-app Security Posture page.",
    ],
  },
  {
    heading: "7. Sharing",
    paragraphs: [
      "We do not sell personal data, ever. We share it only with the subprocessors above, when required by law, or as part of a business transfer (in which case this policy continues to apply).",
    ],
  },
  {
    heading: "8. Your rights",
    paragraphs: [
      "You may request access to, correction of, or deletion of your personal data, and you may opt out of any non-essential email. Visitors: contact us directly. Staff Users: your pharmacy controls your roster data — ask your administrator, and we will support the request. Contact for all privacy matters: privacy@rxshift.io.",
    ],
  },
  {
    heading: "9. Age, changes, contact",
    paragraphs: [
      "The Service is for users 18 and older. We will post changes to this policy here and, for material changes, notify Customers by email with at least 30 days' notice. Contact: privacy@rxshift.io · JWC LLC d/b/a RxShift.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="bg-white px-6 py-16">
        <div className="mx-auto max-w-[760px]">
          <p className="font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
            Legal
          </p>
          <h1 className="mt-3 font-brand text-3xl font-bold tracking-[-0.3px] text-navy">
            Privacy Policy
          </h1>
          <p className="mt-2 font-body text-sm text-steel">
            Effective June 2026 · JWC LLC d/b/a RxShift
          </p>

          <div className="mt-10 space-y-8">
            {SECTIONS.map((s) => (
              <section key={s.heading}>
                <h2 className="font-brand text-lg font-bold text-navy">
                  {s.heading}
                </h2>
                {s.paragraphs.map((p, i) => (
                  <p
                    key={i}
                    className="mt-2 font-body text-[15px] leading-[1.7] text-steel"
                  >
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>

          <p className="mt-12 border-t border-line pt-6 font-body text-xs text-steel">
            Questions about this policy: privacy@rxshift.io.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
