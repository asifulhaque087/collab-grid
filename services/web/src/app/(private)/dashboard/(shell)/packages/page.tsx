import { PageHeader } from "@/components/dashboard/page-header";
import { PackagesView } from "@/components/packages/packages-view";
import type { ApiPackage, ApiPermission } from "@/types";
import { authHeaders, privateApi } from "@/lib/api";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await privateApi(path, { headers: await authHeaders() });
  if (!res.ok) return [] as unknown as T;
  return res.json();
}

export default async function PackagesPage() {
  const [packages, permissions] = await Promise.all([fetchJson<ApiPackage[]>("/packages"), fetchJson<ApiPermission[]>("/packages/permissions")]);

  return (
    <>
      <PageHeader title="Packages" subtitle="Manage subscription tiers and permissions" />
      <PackagesView packages={packages} permissions={permissions} />
    </>
  );
}
