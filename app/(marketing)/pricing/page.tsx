import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/nav";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: "Pricing — RxShift",
  description:
    "RxShift is priced per location, per month. Volume pricing available for groups of 5+ locations.",
};

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main className="flex-1 px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-[680px] text-center">
          <h1 className="font-brand text-3xl font-bold tracking-[-0.3px] text-navy sm:text-4xl">
            Pricing for 1–25 locations.
          </h1>
          <div className="mx-auto mt-6 max-w-[560px] space-y-4 font-body text-base leading-[1.7] text-steel">
            <p>
              RxShift is priced per location, per month. Volume pricing
              available for groups of 5+ locations.
            </p>
            <p>
              We&rsquo;re currently in pilot with Nevada pharmacies. Pilot
              participants receive early pricing.
            </p>
            <p>Talk to us about your specific setup.</p>
          </div>
          <Link href="/#demo"
            className="mt-8 inline-block rounded-md bg-amber px-6 py-3 font-brand text-sm font-bold text-white transition-colors hover:bg-amber-dark"
          >
            Schedule a Demo
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
