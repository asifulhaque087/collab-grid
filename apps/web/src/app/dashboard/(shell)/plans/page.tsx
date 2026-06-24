import { getPlans } from "@/lib/mock/commerce";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PlansActions } from "@/components/plans/plans-actions";

export default async function PlansPage() {
  const plans = await getPlans();

  return (
    <>
      <PageHeader
        title="Plans"
        subtitle="Manage subscription tiers and quotas"
        actions={<PlansActions />}
      />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-md border bg-surface p-[18px] ${
              plan.highlighted ? "border-active" : "border-border"
            }`}
          >
            <div className="mb-3.5 flex items-center justify-between">
              <span className="text-[1.05rem] font-bold text-text">{plan.name}</span>
              {plan.badge && (
                <StatusBadge variant={plan.badge.variant}>{plan.badge.label}</StatusBadge>
              )}
            </div>
            <div className="mb-3 font-mono text-[1.8rem] font-bold text-text">
              {plan.price}
              <span className="text-[0.8rem] font-medium text-text-muted">{plan.priceUnit}</span>
            </div>
            <div className="text-[0.8rem] leading-[1.8] text-text-dim">{plan.quotaSummary}</div>
            <div className="mt-3.5 border-t border-border pt-3 font-mono text-[0.72rem] text-text-muted">
              {plan.subscribers} tenants subscribed
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
