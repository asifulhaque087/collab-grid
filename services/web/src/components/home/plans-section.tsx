import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getPublicPlans, type PublicPlan } from "@/lib/public-plans";
import { SectionHead } from "./section-head";

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.2">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

// Short marketing blurb per known plan; falls back to a generic line so new
// plans created in the dashboard still render sensibly.
const PLAN_BLURB: Record<string, string> = {
  free: "For your first drop and a small crew.",
  pro: "For tenants running live, high-volume drops.",
};

function PlanCard({ plan }: { plan: PublicPlan }) {
  const isFree = plan.monthlyPrice === 0;
  const price = isFree ? "$0" : `$${plan.monthlyPrice}`;
  const priceUnit = isFree ? "/forever" : "/month";
  const ctaLabel = isFree ? "Start free" : `Choose ${plan.title}`;

  return (
    <div className={`plan${plan.featured ? " featured" : ""}`}>
      {plan.featured && <span className="tag">POPULAR</span>}
      <h3>{plan.title}</h3>
      <div className="price">
        <b>{price}</b>
        <span>{priceUnit}</span>
      </div>
      <p className="blurb">
        {PLAN_BLURB[plan.slug] ?? "Real-time boards, scaled for your team."}
      </p>
      <ul>
        {plan.features.map((f, i) => (
          <li key={i}>
            <CheckIcon />
            {f.value && <b>{f.value}</b>} {f.text}
          </li>
        ))}
        <li>
          <CheckIcon />
          Real-time canvas &amp; checkout queue
        </li>
      </ul>
      <Button asChild variant={plan.featured ? "primary" : "secondary"} className="w-full">
        <Link href={`/sign-up?plan=${plan.slug}`}>{ctaLabel}</Link>
      </Button>
    </div>
  );
}

export async function PlansSection() {
  const plans = await getPublicPlans();

  return (
    <section className="plans" id="plans">
      <div className="wrap">
        <SectionHead
          eyebrow="Monetization"
          title="Start free. Upgrade when the boards fill up."
        />
        <div className="plan-grid">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  );
}
