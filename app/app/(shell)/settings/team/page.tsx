import { createClient } from "@/lib/supabase/server";
import TeamManager from "@/components/app/settings/team-manager";
import type { AppUser, Department, Staff } from "@/lib/types";

export default async function TeamSettingsPage() {
  const supabase = await createClient();
  const [{ data: users }, { data: staff }, { data: departments }] =
    await Promise.all([
      supabase.from("app_user").select("*").order("created_at"),
      supabase.from("staff").select("*").order("full_name"),
      supabase.from("department").select("*").order("name"),
    ]);

  return (
    <div className="max-w-[920px]">
      <p className="mb-6 max-w-[620px] font-body text-sm leading-relaxed text-steel">
        Who can sign in and what they can do. Staff accounts are created
        automatically the first time someone signs in with a login email that
        matches the staff roster. Designate a primary PTO approver plus backups
        so requests clear when the primary is out.
      </p>
      <TeamManager
        users={(users ?? []) as AppUser[]}
        staff={(staff ?? []) as Staff[]}
        departments={(departments ?? []) as Department[]}
      />
    </div>
  );
}
