import { SiteNav } from "@/components/home/site-nav";
import { HeroBento } from "@/components/home/hero-bento";
import { BoardDemo } from "@/components/home/board-demo";
import { LockLifecycle } from "@/components/home/lock-lifecycle";
import { ArchitectureSection } from "@/components/home/architecture-section";
import { PlansSection } from "@/components/home/plans-section";
import { SiteFooter } from "@/components/home/site-footer";

// Public marketing homepage. Server component composing the section islands;
// interactivity lives in the live counter, lifecycle tabs, and board demo.
export default function Home() {
  return (
    <div className="home-page" id="top">
      <SiteNav />
      <HeroBento />
      <BoardDemo />
      <LockLifecycle />
      <ArchitectureSection />
      <PlansSection />
      <SiteFooter />
    </div>
  );
}
