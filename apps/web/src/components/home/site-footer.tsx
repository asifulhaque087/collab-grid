import { NAV_LINKS } from "@/lib/home-content";
import { LogoMark } from "./logo-mark";

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap foot-inner">
        <span className="logo" style={{ fontSize: 16 }}>
          <LogoMark />
          CollabGrid
        </span>
        <div className="foot-links">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </div>
        <p>Prototype · canvas · Redis locks · queued checkout</p>
      </div>
    </footer>
  );
}
