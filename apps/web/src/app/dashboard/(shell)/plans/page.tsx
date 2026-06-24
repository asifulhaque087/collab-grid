import { cookies } from "next/headers";
import { PageHeader } from "@/components/dashboard/page-header";
import { PlansView } from "@/components/plans/plans-view";
import type { ApiPlan, ApiPermission } from "@/types";

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
