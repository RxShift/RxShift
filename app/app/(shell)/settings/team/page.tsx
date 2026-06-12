import { redirect } from "next/navigation";

// Team & Roles merged into the Staff page — roles and PTO-approver status
// are edited on the person, in one place.
export default function TeamSettingsPage() {
  redirect("/app/staff");
}
