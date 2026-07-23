import { PageHeader } from "@/components/dashboard/page-header";
import { PlansView } from "@/components/plans/plans-view";
import type { ApiPlan, ApiPermission } from "@/types";
import { authHeaders, privateApi } from "@/lib/api";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await privateApi(path, { headers: await authHeaders() });
  if (!res.ok) return [] as unknown as T;
  return res.json();
}

export default async function PlansPage() {
  const [plans, permissions] = await Promise.all([fetchJson<ApiPlan[]>("/packages"), fetchJson<ApiPermission[]>("/packages/permissions")]);

  return (
    <>
      <PageHeader title="Plans" subtitle="Manage subscription tiers and permissions" />
      <PlansView plans={plans} permissions={permissions} />
    </>
  );
}
