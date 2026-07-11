import { PageHeader } from "@/components/dashboard/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { SecurityForm } from "@/components/settings/security-form";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Account and security preferences" />
      <div className="max-w-[560px]">
        <ProfileForm />
        <SecurityForm />
        <DeleteAccountCard />
      </div>
    </>
  );
}
