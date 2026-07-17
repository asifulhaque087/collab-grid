// Server-side fetch for the public plan cards shown on the marketing homepage
// and the subscription checkout page. No auth required.

import { API_URL, publicApi } from "@/lib/api";

export interface PublicPlanFeature {
  value: string;
  text: string;
}

export interface PublicPlan {
  id: string;
  slug: string;
  title: string;
  monthlyPrice: number;
  featured: boolean;
  features: PublicPlanFeature[];
}

export async function getPublicPlans(): Promise<PublicPlan[]> {
  try {
    // const res = await fetch(`${API_URL}/packages/public`);
    // const res = await fetch(`${API_URL}/packages/public`);
    const res = await publicApi("/packages/public");

    if (!res.ok) return [];
    return (await res.json()) as PublicPlan[];
  } catch {
    return [];
  }
}
