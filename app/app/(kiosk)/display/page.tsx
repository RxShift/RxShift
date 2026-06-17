import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { buildBoardView } from "@/lib/board-data";
import LocationCard from "@/components/app/board/location-card";
import DisplayBoard from "@/components/app/board/display-board";

export const dynamic = "force-dynamic";

// Read-only wall-display board at /app/display. Same data as the in-shell Live
// Board (buildBoardView), rendered large with no status controls. ?location=<id>
// pins one site so each monitor shows its own location.
export default async function DisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const session = await getSession();
  const tenant = session!.tenant!;
  if (!tenant.has_ratio) redirect("/app/dashboard");

  const supabase = await createClient();
  const view = await buildBoardView(supabase, tenant);
  const { location } = await searchParams;
  const locationId = location ?? null;

  const cards = locationId
    ? view.locationCards.filter((c) => c.locationId === locationId)
    : view.locationCards;
  const locations = view.locationCards.map((c) => ({
    id: c.locationId,
    name: c.locationName,
  }));

  return (
    <DisplayBoard
      tenantName={tenant.name}
      locations={locations}
      selectedLocationId={locationId}
    >
      {cards.length === 0 ? (
        <div className="rounded-[10px] border-[1.5px] border-dashed border-line bg-surface px-6 py-16 text-center font-body text-sm text-steel">
          {view.noPeriodToday
            ? "No schedule covers today yet."
            : "No one is on shift right now."}
        </div>
      ) : (
        <div
          className={`grid gap-5 ${
            cards.length <= 1
              ? "grid-cols-1"
              : cards.length === 2
                ? "md:grid-cols-2"
                : "md:grid-cols-2 xl:grid-cols-3"
          }`}
        >
          {cards.map((c) => (
            <LocationCard key={c.locationId} loc={c} size="large" />
          ))}
        </div>
      )}
    </DisplayBoard>
  );
}
