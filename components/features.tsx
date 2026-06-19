import Image from "next/image";

const FEATURES = [
  {
    eyebrow: "Scheduling",
    heading: "Ratio-aware schedule generation",
    body: "Configure your state's pharmacist-to-tech rules once. RxShift applies them to every shift you build, recalculates as the schedule changes, and flags any deficient slot before you publish — so gaps get fixed on the screen, not on the floor.",
    image: "/images/screenshots/schedule-all-locations.jpg",
    position: "object-top",
    alt: "The RxShift schedule grid with pharmacists and technicians in separate bands and ratio flags",
  },
  {
    eyebrow: "Compliance",
    heading: "An automated hourly Compliance Record",
    body: "RxShift builds a timestamped hourly Compliance Record of what actually happened — pharmacist and tech names per hour, deficiency flags, and an alert to your managers after 3 consecutive deficient days, when a board report may be required. It finalizes hour by hour from the published schedule and your team's live statuses, retained two years and exportable on demand. RxShift never contacts your board; that call stays yours.",
    image: "/images/screenshots/compliance-record.jpg",
    position: "object-top",
    alt: "The RxShift Compliance Record showing pharmacist and technician names per hour, all compliant",
  },
  {
    eyebrow: "Built for your size",
    heading: "Designed for 1–25 locations",
    body: "Not enterprise software. Not a generic scheduling tool with compliance bolted on. RxShift is built for independent pharmacies and regional chains — up and running in under an hour, with no implementation fee and no six-month onboarding.",
    image: "/images/screenshots/dashboard.jpg",
    position: "object-bottom",
    alt: "The RxShift dashboard showing three pharmacy location cards with Nevada addresses",
  },
];

export default function Features() {
  return (
    <section className="bg-white px-6 py-12 sm:py-20">
      <div className="mx-auto grid max-w-[1040px] gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.eyebrow}
            className="overflow-hidden rounded-[10px] border border-line bg-white shadow-[0_1px_3px_rgba(28,47,94,0.08)]"
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-line bg-cloud">
              <Image
                src={f.image}
                alt={f.alt}
                fill
                className={`object-cover ${f.position}`}
                sizes="(max-width: 640px) 100vw, (max-width: 1040px) 50vw, 340px"
              />
            </div>
            <div className="p-7">
              <p className="font-brand text-[10px] font-bold uppercase tracking-[1.8px] text-amber">
                {f.eyebrow}
              </p>
              <h3 className="mb-2 mt-3 font-brand text-lg font-bold text-navy">
                {f.heading}
              </h3>
              <p className="font-body text-sm leading-[1.65] text-steel">
                {f.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
