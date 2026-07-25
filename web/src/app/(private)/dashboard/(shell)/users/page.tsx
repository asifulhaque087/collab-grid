import { PageHeader } from "@/components/dashboard/page-header";
import { UsersView } from "@/components/users/users-view";
import type { ApiUser, ApiRole } from "@/types";
import { authHeaders, privateApi } from "@/lib/api";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await privateApi(path, { headers: await authHeaders() });
  if (!res.ok) return [] as unknown as T;
  return res.json();
}

export default async function UsersPage() {
  const [users, roles] = await Promise.all([
    fetchJson<ApiUser[]>("/users"),
    fetchJson<ApiRole[]>("/roles"),
  ]);

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Manage tenant members and their role assignments"
      />
      <UsersView users={users} roles={roles} />
    </>
  );
}
