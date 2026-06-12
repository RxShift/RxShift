import { redirect } from "next/navigation";
import RxShiftMark from "@/components/rxshift-mark";

// Interstitial for alias sign-in links. The emailed link lands HERE and
// does NOT consume the one-time token — corporate mail scanners (Outlook
// SafeLinks and friends) prefetch every link in an email and would burn
// the token before the user ever clicks. Only the explicit button press
// (a POST to ./confirm/complete) performs the actual verification.
export default async function ConfirmSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash, type } = await searchParams;
  if (!token_hash || !type) redirect("/app/login?error=link");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-page px-6">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center">
          <RxShiftMark size={64} />
          <h1 className="mt-6 font-brand text-2xl font-bold text-navy">
            Almost there
          </h1>
          <p className="mt-2 font-body text-sm text-steel">
            Click below to finish signing in.
          </p>
        </div>
        <form
          method="post"
          action="/app/auth/confirm/complete"
          className="rounded-[10px] border border-line bg-white p-8 shadow-[0_1px_3px_rgba(28,47,94,0.08)]"
        >
          <input type="hidden" name="token_hash" value={token_hash} />
          <input type="hidden" name="type" value={type} />
          <button
            type="submit"
            className="w-full rounded-md bg-amber px-5 py-2.5 font-brand text-sm font-bold text-white transition-colors hover:bg-amber-dark"
          >
            Sign in to RxShift
          </button>
          <p className="mt-3 text-center font-body text-xs text-steel">
            This link works once and expires an hour after it was sent.
          </p>
        </form>
      </div>
    </main>
  );
}
