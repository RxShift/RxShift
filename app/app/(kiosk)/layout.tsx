import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Chrome-free shell for wall displays: authenticated like the rest of /app, but
// NO sidebar and NO banners — just the board, edge to edge. A monitor's machine
// logs in once and leaves this URL running. (A no-login signed display token is
// future work — see docs/decisions.md.)
export default async function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/app/login");
  if (!session.appUser || !session.tenant) redirect("/app/onboarding");

  // Match the tenant's accent (same validated override as the app shell) so the
  // display looks like their pharmacy, not generic RxShift.
  const branding = session.tenant.branding;
  const accent =
    branding?.primary_color && /^#[0-9A-Fa-f]{6}$/.test(branding.primary_color)
      ? branding.primary_color
      : null;

  return (
    <div className={`min-h-screen${accent ? " rx-tenant" : ""}`}>
      {accent && <style>{`.rx-tenant{--color-amber:${accent};}`}</style>}
      {children}
    </div>
  );
}
