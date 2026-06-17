import { existsSync } from "fs";
import { join } from "path";
import Image from "next/image";

// The real-time ratio board. Prefers the captured GIF (unoptimized so it
// animates — Next would otherwise freeze a GIF to one frame); falls back to the
// static board screenshot if the GIF wasn't generated (e.g., no tech on shift
// at capture time).
export default function LiveBoardShowcase() {
  const hasGif = existsSync(
    join(process.cwd(), "public", "images", "screenshots", "live-board.gif")
  );

  return (
    <section className="bg-cloud px-6 py-12 sm:py-20">
      <div className="mx-auto max-w-[900px] text-center">
        <p className="font-brand text-[10px] font-bold uppercase tracking-[1.8px] text-amber">
          Real-time ratio board
        </p>
        <h2 className="mt-4 font-brand text-[26px] font-bold leading-snug text-navy sm:text-[32px]">
          Mark a tech to lunch — the ratio updates instantly.
        </h2>
        <p className="mx-auto mt-4 max-w-[560px] font-body text-base leading-[1.7] text-steel">
          The live board reflects who&rsquo;s actually working right now. One tap
          and the counts recompute — so a deficiency surfaces the moment it
          happens, not after the shift.
        </p>
        <div className="mx-auto mt-8 overflow-hidden rounded-xl border border-line shadow-[0_24px_60px_-15px_rgba(28,47,94,0.25)]">
          {hasGif ? (
            <Image
              src="/images/screenshots/live-board.gif"
              alt="The RxShift live ratio board recomputing technician counts in real time as a staff member's status changes"
              width={1100}
              height={340}
              className="w-full"
              unoptimized
            />
          ) : (
            <Image
              src="/images/screenshots/live-board.jpg"
              alt="The RxShift live ratio board showing per-location pharmacist and technician counts"
              width={1440}
              height={900}
              className="w-full"
            />
          )}
        </div>
      </div>
    </section>
  );
}
