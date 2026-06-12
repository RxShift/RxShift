"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { createNextPeriod } from "@/lib/actions/schedule";

export default function NewPeriodButton({ locationId }: { locationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    const result = await createNextPeriod(locationId);
    if (result.ok && result.data) {
      router.push(`/app/schedule?location=${locationId}&period=${result.data.id}`);
      router.refresh();
    } else if (!result.ok) {
      alert(result.error);
    }
    setBusy(false);
  }

  return (
    <Button onClick={handleClick} disabled={busy}>
      {busy ? "Creating…" : "New period"}
    </Button>
  );
}
