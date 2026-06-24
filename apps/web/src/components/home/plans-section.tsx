import Link from "next/link";
import type { HomePlan } from "@/types/home";
import { Button } from "@/components/ui/button";
import { HOME_PLANS } from "@/lib/home-content";
import { SectionHead } from "./section-head";

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.2">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function PlanCard({ plan }: { plan: HomePlan }) {
  return (
    <div className={`plan${plan.featured ? " featured" : ""}`}>
      {plan.tag && <span className="tag">{plan.tag}</span>}
      <h3>{plan.name}</h3>
      <div className="price">
        <b>{plan.price}</b>
        <span>{plan.priceUnit}</span>
      </div>
      <p className="blurb">{plan.blurb}</p>
      <ul>
        {plan.features.map((f, i) => (
          <li key={i}>
            <CheckIcon />
            {f.value && <b>{f.value}</b>} {f.text}
          </li>
        ))}
      </ul>
      <Button asChild variant={plan.featured ? "primary" : "secondary"} className="w-full">
        <Link href={plan.cta.href}>{plan.cta.label}</Link>
      </Button>
    </div>
  );
}

export function PlansSection() {
  return (
    <section className="plans" id="plans">
      <div className="wrap">
        <SectionHead
          eyebrow="Monetization"
          title="Start free. Upgrade when the boards fill up."
        />
        <div className="plan-grid">
          {HOME_PLANS.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  );
}
