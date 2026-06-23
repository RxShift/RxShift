import { existsSync } from "fs";
import { join } from "path";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import { Card } from "@/components/ui/card";

// Internal-review draft. Reachable at /about by direct URL only — deliberately
// NOT linked from the nav or footer, and kept out of search engines.
export const metadata: Metadata = {
  title: "About — RxShift",
  robots: { index: false, follow: false },
};

const TEAM_DIR = join(process.cwd(), "public", "images", "team");
const hasPhoto = (file: string) => existsSync(join(TEAM_DIR, file));

function TeamPhoto({
  src,
  file,
  alt,
  initials,
}: {
  src: string;
  file: string;
  alt: string;
  initials: string;
}) {
  if (hasPhoto(file)) {
    return (
      <div className="team-photo">
        <Image
          src={src}
          alt={alt}
          width={120}
          height={120}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  // Build-safe fallback when the photo isn't present.
  return (
    <div className="flex h-[120px] w-[120px] flex-shrink-0 items-center justify-center rounded-full bg-cloud">
      <span className="font-brand text-[28px] font-bold text-steel">
        {initials}
      </span>
    </div>
  );
}

interface Founder {
  src: string;
  file: string;
  initials: string;
  name: string;
  role: string;
  bio: string[];
  linkedin: string;
}

const FOUNDERS: Founder[] = [
  {
    src: "/images/team/susie.jpg",
    file: "susie.jpg",
    initials: "SM",
    name: "Susie Monahan-West, Pharm.D., BCGP.",
    role: "Pharmacist in Charge · Optum / Southwest Medical Associates · Las Vegas, NV",
    bio: [
      "Susie has been the Pharmacist in Charge at Southwest Medical Associates in Las Vegas since 2016, managing scheduling and ratio compliance for a multi-location Optum-owned pharmacy. She holds a Doctor of Pharmacy from Roseman University of Health Sciences and is Board Certified in Geriatric Pharmacy (BCGP).",
      "She built RxShift's compliance logic from the ground up — based on ten years of doing it by hand.",
    ],
    linkedin:
      "https://www.linkedin.com/in/susie-monahan-west-pharm-d-bcgp-a7851b126/",
  },
  {
    // Cropped to a face-centered square; distinct filename so it never collides
    // with a cached copy of the earlier wide photo.
    src: "/images/team/jamison-headshot.jpg",
    file: "jamison-headshot.jpg",
    initials: "JW",
    name: "Jamison West",
    role: "Co-Founder & CSO, TimeZest and MSP+ · Henderson, NV",
    bio: [
      "Jamison has founded and sold two B2B software companies. He sold Arterian, an MSP, in 2016 after four acquisitions in 22 months. He later served as CEO of SmileBack, a customer satisfaction SaaS platform acquired by ConnectWise. He is currently Co-Founder and Chief Strategy Officer at TimeZest and MSP+.",
      "He built RxShift's architecture and product — working with Susie to translate her compliance process into software that works the way a pharmacy actually does.",
    ],
    linkedin: "https://www.linkedin.com/in/jamisonwest/",
  },
];

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Section 1 — Navy hero */}
        <section className="bg-navy px-6 py-16 sm:py-24">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="font-brand text-[10px] font-bold uppercase tracking-[1.8px] text-amber">
              The Team
            </p>
            <h1 className="mt-4 font-brand text-4xl font-bold leading-tight tracking-[-0.3px] text-white sm:text-5xl">
              Built by people who&rsquo;ve done this before.
            </h1>
            <p className="mx-auto mt-6 max-w-[620px] font-body text-lg leading-[1.7] text-steel-light">
              One of us has been managing pharmacy schedules and ratio
              compliance for over a decade. The other has built and sold two B2B
              software companies. We built RxShift because we couldn&rsquo;t
              find a tool that did what we needed.
            </p>
            <p className="mt-6 font-brand text-lg font-medium italic text-amber">
              Built for pharmacists, by a pharmacist.
            </p>
          </div>
        </section>

        {/* Section 2 — Two-column bio cards */}
        <section className="bg-cloud px-6 py-16 sm:py-20">
          <div className="mx-auto grid max-w-[1000px] gap-6 md:grid-cols-2">
            {FOUNDERS.map((f) => (
              <Card key={f.name} className="p-7">
                <div className="flex items-start gap-5">
                  <TeamPhoto
                    src={f.src}
                    file={f.file}
                    alt={f.name}
                    initials={f.initials}
                  />
                  <div className="min-w-0">
                    <p className="font-brand text-[10px] font-bold uppercase tracking-[1.5px] text-amber">
                      Co-Founder
                    </p>
                    <h2 className="mt-1 font-brand text-[24px] font-bold leading-tight text-navy">
                      {f.name}
                    </h2>
                    <p className="mt-2 font-body text-sm font-medium leading-snug text-steel">
                      {f.role}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {f.bio.map((para, i) => (
                    <p
                      key={i}
                      className="font-body text-[15px] leading-[1.7] text-steel"
                    >
                      {para}
                    </p>
                  ))}
                </div>

                <p className="mt-5">
                  <a
                    href={f.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-body text-sm font-medium text-amber hover:underline"
                  >
                    LinkedIn →
                  </a>
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* Section 3 — Navy CTA strip */}
        <section className="bg-navy px-6 py-16">
          <div className="mx-auto flex max-w-[760px] flex-col items-center gap-6 text-center">
            <h2 className="font-brand text-[26px] font-bold leading-snug text-white sm:text-[30px]">
              Curious what RxShift looks like in practice?
            </h2>
            <Link
              href="/#demo"
              className="inline-block rounded-md bg-amber px-6 py-3 font-brand text-sm font-bold text-white transition-colors hover:bg-amber-dark"
            >
              Schedule a Demo
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
