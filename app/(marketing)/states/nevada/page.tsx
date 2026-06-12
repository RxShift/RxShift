import { redirect } from "next/navigation";

// Nevada lives at /nevada (the original SEO path); /states/nevada keeps
// the state-by-state URL pattern working.
export default function StatesNevadaRedirect() {
  redirect("/nevada");
}
