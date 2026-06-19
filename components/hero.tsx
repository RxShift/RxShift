import Image from "next/image";
import BrowserFrame from "@/components/browser-frame";

export default function Hero() {
  return (
    <section className="px-6 py-16 sm:py-24">
      <div className="mx-auto grid max-w-[1120px] items-center gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Left — text */}
        <div className="text-center lg:text-left">
          <h1 className="font-brand text-4xl font-bold leading-tight tracking-[-0.3px] text-navy sm:text-5xl">
            Your schedule knows the ratios.
            <br />
            So you don&rsquo;t have to.
          </h1>
          <p className="mx-auto mt-6 max-w-[540px] font-body text-lg leading-[1.7] text-steel lg:mx-0">
            RxShift generates compliant pharmacy schedules automatically —
            tracking pharmacist-to-tech ratios, keeping an hour-by-hour
            compliance record, and handling the staffing math that
            spreadsheets get wrong.
          </p>
          <div className="mt-8">
            <a
              href="#demo"
              className="inline-block rounded-md bg-amber px-6 py-3 font-brand text-sm font-bold text-white transition-colors hover:bg-amber-dark"
            >
              Schedule a Demo
            </a>
            <p className="mt-4 font-body text-[13px] text-steel">
              Piloting now with Nevada pharmacies.
            </p>
          </div>
        </div>

        {/* Right — the product, in a browser frame (desktop) / bare (mobile) */}
        <div>
          <div className="hidden lg:block">
            <BrowserFrame>
              <Image
                src="/images/screenshots/schedule-all-locations.jpg"
                alt="RxShift schedule builder — the all-locations view with pharmacist and technician bands, work-type-colored shifts, a Published badge, and ratio flags"
                width={1440}
                height={900}
                className="w-full"
                priority
              />
            </BrowserFrame>
          </div>
          <div className="lg:hidden">
            <Image
              src="/images/screenshots/schedule-all-locations.jpg"
              alt="RxShift schedule builder showing the all-locations view"
              width={1440}
              height={900}
              className="w-full rounded-lg border border-line shadow-[0_8px_24px_-8px_rgba(28,47,94,0.25)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
