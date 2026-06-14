import { getSession } from "@/lib/auth";
import OrgSettingsForm from "@/components/app/settings/org-form";
import BrandingForm from "@/components/app/settings/branding-form";
import GoLiveCard from "@/components/app/settings/go-live-card";
import DangerZone from "@/components/app/settings/danger-zone";

export default async function OrganizationSettingsPage() {
  const session = await getSession();
  const tenant = session!.tenant!;
  const isOwner = session!.appUser!.role === "owner_admin";

  return (
    <div className="max-w-[560px]">
      <OrgSettingsForm tenant={tenant} />
      {isOwner && <BrandingForm tenant={tenant} />}
      {tenant.status !== "live" && isOwner && !tenant.is_demo && (
        <GoLiveCard status={tenant.status} />
      )}
      {isOwner && <DangerZone tenantName={tenant.name} />}
    </div>
  );
}
