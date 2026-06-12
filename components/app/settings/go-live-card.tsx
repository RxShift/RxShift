"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { goLiveTenant } from "@/lib/actions/settings";

/**
 * The trial → live switch. Shown only while the tenant is not live.
 * Going live is the moment email starts flowing to the whole roster, so
 * it takes a explicit two-step confirmation with a plain-language warning.
 */
export default function GoLiveCard({ status }: { status: "setup" | "trial" }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function goLive() {
    setBusy(true);
    const result = await goLiveTenant();
    if (!result.ok) alert(result.error);
    router.refresh();
    setBusy(false);
    setConfirming(false);
  }

  return (
    <Card className="mt-6">
      <div className="flex items-center gap-2">
        <h2 className="font-brand text-base font-bold text-navy">
          Trial mode
        </h2>
        <Badge tone="alert">{status === "setup" ? "Setup" : "Trial"}</Badge>
      </div>
      <p className="mt-2 font-body text-sm text-steel">
        Your pharmacy is in trial mode: everything works — schedules,
        requests, the compliance record — but RxShift is{" "}
        <strong>not sending email to your staff</strong>. Load your data,
        check the roster, and go live when you&rsquo;re ready.
      </p>

      {!confirming ? (
        <div className="mt-4">
          <Button onClick={() => setConfirming(true)}>Go live</Button>
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-line bg-cloud p-4">
          <p className="font-body text-sm text-navy">
            <strong>Going live turns on email to your whole staff.</strong>{" "}
            Time-off decisions, swap requests, and callout alerts will be
            sent to the addresses on your roster. Make sure roster emails
            are correct before continuing.
          </p>
          <div className="mt-3 flex gap-3">
            <Button disabled={busy} onClick={goLive}>
              Yes, go live
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Stay in trial
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
