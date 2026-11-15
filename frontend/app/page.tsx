import { LandingNavbar } from "@/components/landing/navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { PipelineFlowSection } from "@/components/landing/pipeline-flow-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { CapabilitiesSection } from "@/components/landing/capabilities-section";
import { BenefitsSection } from "@/components/landing/benefits-section";
import { LandingFooter } from "@/components/landing/footer";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingNavbar />
      <main className="flex-1">
        <HeroSection />
        <PipelineFlowSection />
        <FeaturesSection />
        <CapabilitiesSection />
        <BenefitsSection />
      </main>
      <LandingFooter />
    </div>
  );
}
