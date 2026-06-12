import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
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

  return <OnboardingWizard userEmail={session.email} />;
}
