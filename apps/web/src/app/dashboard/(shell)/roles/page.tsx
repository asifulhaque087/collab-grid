import { cookies } from "next/headers";
import { PageHeader } from "@/components/dashboard/page-header";
import { RolesView } from "@/components/roles/roles-view";
import type { ApiRole, ApiPermission } from "@/types";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

async function fetchJson<T>(path: string): Promise<T> {
  const store = await cookies();
  const token = store.get("accessToken")?.value;
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Cookie: `accessToken=${token}` } : {},
    cache: "no-store",
  });
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
