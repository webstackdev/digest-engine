"use client";

import Clients from "@/components/HomePage/Clients";
import Features from "@/components/HomePage/Features";
import Hero from "@/components/HomePage/Hero";
import Pricing from "@/components/HomePage/Pricing";
import Problems from "@/components/HomePage/Problems";
import { CTA } from "@/components/HomePage/CTA";
import {
  ClientsProps,
  FeatureItems,
  HeroProps,
  PricingProps,
  ProblemsProps,
} from "@/lib/props";

export default function Home() {
  return (
    <section className="marketing-page relative w-full">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-16 pt-4 sm:px-6 md:gap-6 lg:px-8">
        <Hero {...HeroProps} />
        <Problems {...ProblemsProps} />
        <Clients {...ClientsProps} />
        <Features {...FeatureItems} />
        <Pricing {...PricingProps} />
        <CTA />
      </div>
    </section>
  );
}
