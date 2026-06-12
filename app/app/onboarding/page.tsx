import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import OnboardingWizard from "@/components/app/onboarding/wizard";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/app/login");
  if (session.appUser && session.tenant?.onboarding_complete) redirect("/app");

  return <OnboardingWizard userEmail={session.email} />;
}
