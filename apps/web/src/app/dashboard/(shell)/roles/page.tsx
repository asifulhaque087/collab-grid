import { getRoles } from "@/lib/mock/people";
import { PageHeader } from "@/components/dashboard/page-header";
import { RolesActions } from "@/components/roles/roles-actions";
import { RolesTable } from "@/components/roles/roles-table";

export default async function RolesPage() {
  const roles = await getRoles();

  return (
    <>
      <PageHeader
        title="Roles"
        subtitle="Define custom roles and assign permissions"
        actions={<RolesActions />}
      />
      <RolesTable roles={roles} />
    </>
  );
}
