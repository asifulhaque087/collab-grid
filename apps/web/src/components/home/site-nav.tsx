import Link from "next/link";
import { Button } from "@/components/ui/button";
import { APP_ENTRY, NAV_LINKS } from "@/lib/home-content";
import { LogoMark } from "./logo-mark";

// Static sticky nav — blur and responsive link collapse are pure CSS, so this
// stays a server component. In-page links rely on scoped smooth-scroll.
export function SiteNav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <a href="#top" className="logo">
          <LogoMark />
          CollabGrid
        </a>
        <div className="nav-links">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </div>
        <div className="nav-right">
          {/* No auth yet — both entries drop the visitor into the app. */}
          <Button asChild variant="ghost" size="sm" className="auth-signin">
            <Link href={APP_ENTRY}>Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={APP_ENTRY}>Sign up</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
