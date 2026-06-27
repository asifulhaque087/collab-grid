import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getPublicPlans } from "@/lib/public-plans";
import { SubscriptionCheckout } from "@/components/subscription/subscription-checkout";

export const metadata: Metadata = {
  title: "Subscription checkout — CollabGrid",
};

export default async function SubscriptionCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: slug } = await searchParams;
  const plans = await getPublicPlans();
  const plan = slug ? plans.find((p) => p.slug === slug) : undefined;

  if (!plan) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold">Plan not found</h1>
        <p className="text-sm text-text-muted">
          That plan isn’t available. Pick one from the homepage to continue.
        </p>
        <Button asChild variant="secondary">
          <Link href="/#plans">View plans</Link>
        </Button>
      </div>
    );
  }

  return <SubscriptionCheckout plan={plan} />;
}
