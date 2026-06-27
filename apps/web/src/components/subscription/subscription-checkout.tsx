"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { subscribeAction } from "@/actions/subscription";
import type { PublicPlan } from "@/lib/public-plans";

const DURATIONS: { months: 1 | 6 | 12 | 24; label: string }[] = [
  { months: 1, label: "1 month" },
  { months: 6, label: "6 months" },
  { months: 12, label: "12 months" },
  { months: 24, label: "24 months" },
];

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.2">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export function SubscriptionCheckout({ plan }: { plan: PublicPlan }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [months, setMonths] = useState<1 | 6 | 12 | 24>(1);

  const isFree = plan.monthlyPrice === 0;
  const total = useMemo(() => plan.monthlyPrice * months, [plan.monthlyPrice, months]);

  const onPay = () => {
    startTransition(async () => {
      const result = await subscribeAction({ plan: plan.slug, durationMonth: months });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`You're on the ${plan.title} plan.`);
      router.replace("/dashboard");
      router.refresh();
    });
  };

  return (
    <div className="mx-auto grid min-h-screen max-w-3xl content-center gap-8 px-4 py-10 md:grid-cols-[1fr_300px]">
      <div>
        <h1 className="mb-1 text-2xl font-bold">Confirm your subscription</h1>
        <p className="mb-6 text-sm text-text-muted">
          {isFree
            ? "Activate the free plan to start building."
            : "Choose a billing duration and complete payment."}
        </p>

        {!isFree && (
          <>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
              Billing duration
            </h2>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {DURATIONS.map((d) => (
                <button
                  key={d.months}
                  type="button"
                  onClick={() => setMonths(d.months)}
                  className={`rounded-md border p-3 text-center text-sm transition-colors ${
                    months === d.months
                      ? "border-active bg-surface text-text"
                      : "border-border text-text-muted hover:border-text-muted"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </>
        )}

        <Button className="w-full justify-center" disabled={pending} onClick={onPay}>
          <CreditCard />
          {pending
            ? "Processing…"
            : isFree
              ? "Activate free plan"
              : `Pay $${total}`}
        </Button>
        <p className="mt-3 text-[0.72rem] text-text-muted">
          Demo checkout — no real payment is processed.
        </p>
      </div>

      <aside className="h-fit rounded-md border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-muted">
          {plan.title} plan
        </h2>
        <div className="mb-4 font-mono text-2xl font-bold text-text">
          ${plan.monthlyPrice}
          <span className="text-sm font-medium text-text-muted">/month</span>
        </div>
        <ul className="flex flex-col gap-2.5 text-sm text-text-dim">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <CheckIcon />
              {f.value && <b className="text-text">{f.value}</b>} {f.text}
            </li>
          ))}
        </ul>
        {!isFree && (
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4 font-semibold">
            <span>Total</span>
            <span className="font-mono">${total}</span>
          </div>
        )}
        <div className="mt-4 flex items-center gap-2 text-[0.72rem] text-committed">
          <CheckCircle2 className="size-3.5" />
          Cancel anytime
        </div>
      </aside>
    </div>
  );
}
