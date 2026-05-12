"use client";

import Companies from "@/components/HomePage/Companies";
import Features from "@/components/HomePage/Features";
import Hero from "@/components/HomePage/Hero";
import Pricing from "@/components/HomePage/Pricing";
import { CompanyProps, FeatureItems, HeroProps, PricingProps } from "@/lib/props";
import { CTA } from "@/components/HomePage/CTA";

export default function Home() {
  return (
    <section className="marketing-page relative w-full">
      <div className="marketing-shell mx-auto max-w-[1180px] px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <Hero {...HeroProps} />
        <div id="integrations">
          <Companies {...CompanyProps} />
        </div>
        <div id="features">
          <Features {...FeatureItems} />
        </div>
        <div id="pricing">
          <Pricing {...PricingProps} />
        </div>
        <CTA />
      </div>
    </section>
  );
}
