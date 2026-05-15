"use client";

import Clients from "@/components/HomePage/Clients";
import Features from "@/components/HomePage/Features";
import Hero from "@/components/HomePage/Hero";
import Pricing from "@/components/Pricing";
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
    <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 pt-24 md:gap-6">
      <Hero {...HeroProps} />
      <Problems {...ProblemsProps} />
      <Clients {...ClientsProps} />
      <Features {...FeatureItems} />
      <Pricing {...PricingProps} />
      <CTA />
    </main>
  );
}
