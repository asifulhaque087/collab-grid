import { PageHeader } from "@/components/dashboard/page-header";
import { PlansView } from "@/components/plans/plans-view";
import type { ApiPlan, ApiPermission } from "@/types";
import { bffFetch } from "@/lib/api";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await bffFetch(path);
  if (!res.ok) return [] as unknown as T;
  return res.json();
}

export default async function PlansPage() {
  const [plans, permissions] = await Promise.all([
    fetchJson<ApiPlan[]>("/plans"),
    fetchJson<ApiPermission[]>("/plans/permissions"),
  ]);

  return (
    <>
      <PageHeader
        title="Plans"
        subtitle="Manage subscription tiers and permissions"
      />
      <PlansView plans={plans} permissions={permissions} />
    </>
  );
}
