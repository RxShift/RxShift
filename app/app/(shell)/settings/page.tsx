import { getSession } from "@/lib/auth";
import OrgSettingsForm from "@/components/app/settings/org-form";
import DangerZone from "@/components/app/settings/danger-zone";

export default async function OrganizationSettingsPage() {
  const session = await getSession();
  const tenant = session!.tenant!;

  return (
    <div className="max-w-[560px]">
      <OrgSettingsForm tenant={tenant} />
      <DangerZone tenantName={tenant.name} />
    </div>
  );
}
