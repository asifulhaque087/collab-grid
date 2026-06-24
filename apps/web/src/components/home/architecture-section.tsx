import type { ArchCard } from "@/types/home";
import { ARCH_CARDS } from "@/lib/home-content";
import { SectionHead } from "./section-head";

// Inline icon paths ported from the prototype (each themed by its card color).
function ArchIcon({ icon, color }: { icon: ArchCard["icon"]; color: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 1.8,
  } as const;
  switch (icon) {
    case "viewport":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <rect x="8" y="8" width="8" height="8" rx="1" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      );
    case "queue":
      return (
        <svg {...common}>
          <path d="M3 12h4l2-6 4 12 2-6h6" />
        </svg>
      );
    case "socket":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3l8 4v5c0 4.5-3 7.5-8 9-5-1.5-8-4.5-8-9V7z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
  }
}

function Card({ card }: { card: ArchCard }) {
  return (
    <div className="arch-card">
      <div className="arch-ico">
        <ArchIcon icon={card.icon} color={card.iconColor} />
      </div>
      <h3>{card.title}</h3>
      <p>{card.body}</p>
      <div className="tech">{card.tech}</div>
    </div>
  );
}

export function ArchitectureSection() {
  const [a, b, c, d, e] = ARCH_CARDS;
  return (
    <section className="arch" id="arch">
      <div className="wrap">
        <SectionHead
          eyebrow="Built for burst load"
          title="Five problems standard tooling fails at — solved in one platform."
        />
        <div className="arch-grid">
          {[a, b, c].map((card) => (
            <Card key={card.title} card={card} />
          ))}
        </div>
        <div className="arch-row2">
          {[d, e].map((card) => (
            <Card key={card.title} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}
