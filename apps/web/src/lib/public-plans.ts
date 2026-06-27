// Server-side fetch for the public plan cards shown on the marketing homepage
// and the subscription checkout page. No auth required.

const API_URL = process.env.API_URL ?? "http://localhost:3001";

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
    const res = await fetch(`${API_URL}/plans/public`, {
      // Plans change rarely; revalidate periodically rather than per request.
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return (await res.json()) as PublicPlan[];
  } catch {
    return [];
  }
}
