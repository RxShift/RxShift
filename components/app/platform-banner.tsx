"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { emulateAppUser, switchActiveTenant } from "@/lib/actions/platform";

export default function PlatformBanner({
  tenantName,
  emulatingLabel,
}: {
  tenantName: string;
  emulatingLabel: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);

  // Clean marketing screenshots: ?screenshot=true hides the chrome banners.
  if (searchParams.get("screenshot") === "true") return null;

  async function exit() {
    setBusy(true);
    const result = emulatingLabel
      ? await emulateAppUser(null)
      : await switchActiveTenant(null);
    if (!result.ok) alert(result.error);
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-amber px-4 py-1">
      <p className="font-brand text-[11px] font-semibold text-white">
        {emulatingLabel
          ? `Viewing ${tenantName} as ${emulatingLabel}`
          : `Administering ${tenantName} (platform admin)`}
      </p>
      <button
        onClick={exit}
        disabled={busy}
        className="rounded bg-white/20 px-2.5 py-0.5 font-brand text-[11px] font-semibold text-white hover:bg-white/30"
      >
        {emulatingLabel ? "Stop viewing as" : "Exit tenant"}
      </button>
    </div>
  );
}
