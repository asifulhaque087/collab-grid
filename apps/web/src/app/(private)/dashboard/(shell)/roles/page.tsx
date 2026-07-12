import { PageHeader } from "@/components/dashboard/page-header";
import { RolesView } from "@/components/roles/roles-view";
import type { ApiRole, ApiPermission } from "@/types";
import { bffFetch } from "@/lib/api";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await bffFetch(path);
  if (!res.ok) return [] as unknown as T;
  return res.json();
}

export default async function RolesPage() {
  const [roles, permissions] = await Promise.all([
    fetchJson<ApiRole[]>("/roles"),
    fetchJson<ApiPermission[]>("/roles/permissions"),
  ]);

  return (
    <>
      <PageHeader
        title="Roles"
        subtitle="Define custom roles and assign permissions"
      />
      <RolesView roles={roles} permissions={permissions} />
    </>
  );
}
