import RxShiftMark from "./rxshift-mark";

export default function Footer() {
  return (
    <footer className="bg-navy px-6 py-8 lg:px-8">
      <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <RxShiftMark size={60} variant="dark" />
        <p className="font-body text-[13px] text-white/50">
          Compliance-ready pharmacy scheduling
        </p>
        <p className="font-body text-[13px] text-white/40">
          <a href="https://app.rxshift.io" className="hover:text-white/70">
            Log in
          </a>
          {"  ·  © 2026 RxShift  ·  rxshift.io  ·  "}
          <a href="mailto:info@rxshift.io" className="hover:text-white/70">
            info@rxshift.io
          </a>
        </p>
      </div>
    </footer>
  );
}
