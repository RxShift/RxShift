import type { Metadata } from "next";
import Nav from "@/components/nav";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: "Terms of Service — RxShift",
  description: "The terms that govern use of RxShift.",
  robots: { index: false },
};

const SECTIONS: { heading: string; paragraphs: string[] }[] = [
  {
    heading: "1. Definitions",
    paragraphs: [
      "“RxShift,” “we,” or “us” means JWC LLC, doing business as RxShift. “Customer” means the pharmacy or pharmacy group that subscribes to the Service. “Staff User” means an individual (pharmacist, technician, or other staff) given access by a Customer. “Customer Data” means all data a Customer or its Staff Users submit to the Service, including staff rosters, schedules, and compliance records. “Service” means the RxShift application at app.rxshift.io; “Site” means rxshift.io.",
    ],
  },
  {
    heading: "2. The Service and your license",
    paragraphs: [
      "RxShift is scheduling and compliance-documentation software for retail pharmacies. Subject to these terms and payment of applicable fees, we grant the Customer a limited, non-exclusive, non-transferable license to access and use the Service for its internal business operations during the subscription term.",
      "You may not resell or sublicense the Service, reverse-engineer it, use it to build a competing product, or probe its security other than through coordinated disclosure (security@rxshift.io).",
    ],
  },
  {
    heading: "3. Accounts and sign-in",
    paragraphs: [
      "Access is by emailed one-time sign-in links — RxShift stores no passwords. Customers are responsible for keeping their roster's sign-in email addresses accurate, for the actions taken under their users' accounts, and for promptly offboarding departed staff (the Service provides an offboarding control that revokes sign-in while preserving records). Users must be at least 18 years old.",
    ],
  },
  {
    heading: "4. Fees and payment",
    paragraphs: [
      "The Service is priced per location, per month or per year, as published on the pricing page or agreed in writing. Annual plans are billed up front. Fees are exclusive of taxes. We will give at least 30 days' notice before any price change takes effect for an existing subscription, and price changes apply from the next renewal.",
      "Subscriptions renew automatically until canceled. You may cancel at any time, effective at the end of the current billing period; we do not provide refunds for partial periods except where we terminate the Service without cause.",
    ],
  },
  {
    heading: "5. Customer Data: yours, and your compliance records stay reachable",
    paragraphs: [
      "The Customer owns Customer Data. We process it only to provide and improve the Service, and we never sell it. You grant us the limited license needed to host, process, back up, and display Customer Data to your authorized users.",
      "Because compliance records exist to satisfy regulatory retention requirements, on termination the Customer may export its compliance records (and other Customer Data) in standard formats, and we will retain compliance records for the duration of the applicable regulatory retention window (currently two years for hourly staffing records under the rules the Service tracks) before deletion, unless you ask us in writing to delete them sooner. Other Customer Data is deleted within 60 days of termination.",
    ],
  },
  {
    heading: "6. Not legal or regulatory advice",
    paragraphs: [
      "The Service applies the staffing ratio rules you configure and generates documentation from your schedules. It does not provide legal or regulatory advice, and it does not file or submit anything to any board of pharmacy or regulator — reporting decisions and submissions are solely the Customer's responsibility. State rules change; the Customer is responsible for verifying its configured rules against its board's current requirements.",
      "The Service is designed not to receive protected health information. Customers must not submit patient or prescription data to the Service.",
    ],
  },
  {
    heading: "7. Aggregated data",
    paragraphs: [
      "We may use de-identified, aggregated usage data (never identifying a Customer, person, or pharmacy) to operate and improve the Service.",
    ],
  },
  {
    heading: "8. Availability and changes",
    paragraphs: [
      "We aim for high availability but the Service is provided without an uptime guarantee at this stage. We may improve or modify features; we will not materially degrade core functionality (scheduling, the compliance record, exports) during a paid term without notice. Customers are encouraged to export records periodically.",
    ],
  },
  {
    heading: "9. Intellectual property and feedback",
    paragraphs: [
      "We own the Service, the Site, and all related intellectual property. If you send us feedback or suggestions, you grant us a perpetual, royalty-free license to use them without obligation.",
    ],
  },
  {
    heading: "10. Disclaimer of warranties",
    paragraphs: [
      "THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL SATISFY ANY PARTICULAR REGULATORY REQUIREMENT — COMPLIANCE REMAINS THE CUSTOMER'S RESPONSIBILITY.",
    ],
  },
  {
    heading: "11. Limitation of liability",
    paragraphs: [
      "TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY IS LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES. OUR TOTAL LIABILITY ARISING OUT OF THE SERVICE IS LIMITED TO THE FEES THE CUSTOMER PAID IN THE TWELVE MONTHS BEFORE THE CLAIM AROSE. NOTHING IN THESE TERMS LIMITS LIABILITY THAT CANNOT BE LIMITED BY LAW.",
    ],
  },
  {
    heading: "12. Indemnification",
    paragraphs: [
      "The Customer will defend and indemnify RxShift against third-party claims arising from the Customer's breach of these terms, misuse of the Service, or violation of law — including any claim arising from the Customer's staffing or reporting decisions.",
    ],
  },
  {
    heading: "13. Termination",
    paragraphs: [
      "Either party may terminate for material breach uncured 30 days after written notice. We may suspend access for non-payment or misuse after reasonable notice. Sections 5–7 and 9–15 survive termination.",
    ],
  },
  {
    heading: "14. Governing law and disputes",
    paragraphs: [
      "These terms are governed by the laws of the State of Washington, without regard to conflict-of-law rules. The parties will first attempt in good faith to resolve any dispute informally; unresolved disputes will be brought in the state or federal courts located in King County, Washington, and each party consents to their jurisdiction. [Governing law and venue to be confirmed by counsel.]",
    ],
  },
  {
    heading: "15. General",
    paragraphs: [
      "These terms (with any order form and the Privacy Policy) are the entire agreement. We may update these terms with at least 30 days' notice for material changes; continued use after the effective date is acceptance. Neither party is liable for delay caused by events beyond its reasonable control. Notices to us: legal@rxshift.io.",
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main className="bg-white px-6 py-16">
        <div className="mx-auto max-w-[760px]">
          <p className="font-brand text-[11px] font-bold uppercase tracking-[1.8px] text-amber">
            Legal
          </p>
          <h1 className="mt-3 font-brand text-3xl font-bold tracking-[-0.3px] text-navy">
            Terms of Service
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

          <p className="mt-12 border-t border-line pt-6 font-body text-xs italic text-steel">
            Draft — pending attorney review. Questions: legal@rxshift.io.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
