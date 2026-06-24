import Link from "next/link";
import { Button } from "@/components/ui/button";
import { APP_ENTRY, BENTO_STATS } from "@/lib/home-content";
import { LiveCounter } from "./live-counter";

// Hero bento grid: copy cell + live cell + stat cells + viewport cell.
export function HeroBento() {
  return (
    <header className="hero">
      <div className="wrap">
        <div className="bento">
          <div className="cell bento-copy">
            <span className="eyebrow">Real-time spatial commerce</span>
            <h1>
              Stock you can <span className="hl-active">watch move</span>,{" "}
              <span className="hl-soft">lock</span>, and sell — live on a shared canvas.
            </h1>
            <p className="sub">
              CollabGrid streams only the widgets inside your viewport, holds each one with an
              atomic lock the instant it&apos;s clicked, and runs every checkout through a queue that
              physically can&apos;t double-spend.
            </p>
            <div className="cta">
              <Button asChild>
                <Link href={APP_ENTRY}>Get started — it&apos;s free</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="#arch">See how it works</Link>
              </Button>
            </div>
          </div>

          <div className="cell bento-live">
            <div className="live-top">
              <span className="lbl">Live now</span>
              <span className="live-dot" />
            </div>
            <LiveCounter />
            <div className="who">shoppers on this board</div>
          </div>

          {BENTO_STATS.map((s) => (
            <div key={s.lead} className="cell stat bento-soft">
              <div className="k">
                {s.value}
                {s.unit && <small>{s.unit}</small>}
              </div>
              <div className="l">
                <b>{s.lead}</b> {s.caption}
              </div>
            </div>
          ))}

          <div className="cell bento-view">
            <div className="k">~1 viewport</div>
            <div className="mini-grid" />
          </div>
        </div>
      </div>
    </header>
  );
}
