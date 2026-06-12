import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function AppIndex() {
  const session = await getSession();
  if (!session) redirect("/app/login");
  if (!session.appUser || !session.tenant?.onboarding_complete)
    redirect("/app/onboarding");
  redirect(session.appUser.role === "staff" ? "/app/me" : "/app/dashboard");
}
