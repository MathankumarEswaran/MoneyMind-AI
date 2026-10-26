import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { AiSection } from "@/components/landing/ai-section";
import { ArchitectureSection } from "@/components/landing/architecture-section";
import { SecuritySection } from "@/components/landing/security-section";
import { RoadmapSection } from "@/components/landing/roadmap-section";
import { CtaSection } from "@/components/landing/cta-section";
import { usePageTitle } from "@/hooks/use-page-title";

export default function LandingPage() {
  usePageTitle("Your money, with a mind of its own");

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <SiteHeader />
      <main id="main">
        <Hero />
        <Features />
        <AiSection />
        <ArchitectureSection />
        <SecuritySection />
        <RoadmapSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </div>
  );
}
