import { PageHeader, SectionHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { UpgradeCards } from "@/components/billing/upgrade-cards";

function UsageStat({ label, used, total }: { label: string; used: string; total: string }) {
  return (
    <div>
      <div className="text-[0.75rem] text-text-muted">{label}</div>
      <div className="mt-0.5 font-mono font-bold text-text">
        <span className="text-active">{used}</span> / {total}
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <>
      <PageHeader title="Billing" subtitle="Manage your subscription and payment method" />

      <div className="mb-5 rounded-md border border-active bg-surface p-[18px]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="mb-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-text-muted">
              Current Plan
            </div>
            <div className="text-[1.3rem] font-bold text-text">Free Plan</div>
          </div>
          <StatusBadge variant="active">Active</StatusBadge>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-4">
          <UsageStat label="Boards" used="2" total="2" />
          <UsageStat label="Custom Roles" used="2" total="3" />
          <UsageStat label="Widgets / Board" used="24" total="25" />
        </div>
        <div className="text-[0.78rem] text-text-muted">
          Renews — Not applicable (free tier)
        </div>
      </div>

      <SectionHeader title="Upgrade" />
      <UpgradeCards />

      <div className="mt-5 text-[0.78rem] text-text-muted">
        Payment methods: bKash, Nagad, SSLCommerz, Manual transfer
      </div>
    </>
  );
}
