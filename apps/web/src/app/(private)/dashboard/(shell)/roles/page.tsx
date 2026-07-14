import { PageHeader } from "@/components/dashboard/page-header";
import { RolesView } from "@/components/roles/roles-view";
import type { ApiRole, ApiPermission } from "@/types";
import { authHeaders, privateApi } from "@/lib/api";

async function fetchJson<T>(path: string): Promise<T> {
  // const res = await fetch(`http://localhost:3000/api/private${path}`, { headers: await authHeaders() });
  const res = await privateApi(path, { headers: await authHeaders() });
  if (!res.ok) return [] as unknown as T;
  return res.json();
}

export default async function RolesPage() {
  const [roles, permissions] = await Promise.all([fetchJson<ApiRole[]>("/roles"), fetchJson<ApiPermission[]>("/roles/permissions")]);

  return (
    <>
      <PageHeader title="Roles" subtitle="Define custom roles and assign permissions" />
      <RolesView roles={roles} permissions={permissions} />
    </>
  );
}
