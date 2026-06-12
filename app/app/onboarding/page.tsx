import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { tryAttachByRosterEmail } from "@/lib/roster-attach";
import OnboardingWizard from "@/components/app/onboarding/wizard";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/app/login");
  // Platform admins may always create additional tenants here
  if (
    !session.platform.isPlatformAdmin &&
    session.appUser &&
    session.tenant?.onboarding_complete
  ) {
    redirect("/app");
  }

  // Roster auto-attach: if this email is on exactly one pharmacy's staff
  // roster, the person belongs there — attach them as a staff user instead
  // of letting them create a brand-new tenant. Platform admins are exempt
  // (they come here precisely to create tenants).
  if (!session.platform.isPlatformAdmin && !session.appUser) {
    const attached = await tryAttachByRosterEmail(
      session.userId,
      session.email
    );
    if (attached) redirect("/app");
  }

  return <OnboardingWizard userEmail={session.email} />;
}
