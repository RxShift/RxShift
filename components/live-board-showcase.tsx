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
          Know who can step away — without breaking ratio.
        </h2>
        <p className="mx-auto mt-4 max-w-[580px] font-body text-base leading-[1.7] text-steel">
          A pharmacist heading to lunch shouldn&rsquo;t need to do the math — or
          ask the group chat — to know if the floor stays covered. RxShift shows
          exactly how many pharmacists can step away and stay in ratio, and it
          recomputes the instant anyone&rsquo;s status changes.
        </p>
        <div className="mx-auto mt-8 overflow-hidden rounded-xl border border-line shadow-[0_24px_60px_-15px_rgba(28,47,94,0.25)]">
          {hasGif ? (
            <Image
              src="/images/screenshots/live-board.gif"
              alt="The RxShift live status board: a pharmacist steps away and the board recomputes how many pharmacists can still step away while staying in ratio"
              width={1440}
              height={380}
              className="w-full"
              unoptimized
            />
          ) : (
            <Image
              src="/images/screenshots/live-board.jpg"
              alt="The RxShift live ratio board showing per-location pharmacist and technician counts with step-away headroom"
              width={1440}
              height={900}
              className="w-full"
            />
          )}
        </div>
        <p className="mx-auto mt-5 max-w-[560px] font-body text-sm text-steel">
          Staff set their status right from their phone — so the board is always
          current, no computer needed.
        </p>
      </div>
    </section>
  );
}
