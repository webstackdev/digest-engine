"use client";

import Clients from "@/components/HomePage/Clients";
import FAQ from "@/components/HomePage/FAQ";
import Features from "@/components/HomePage/Features";
import Hero from "@/components/HomePage/Hero";
import Solution from "@/components/HomePage/Solution";
import Pricing from "@/components/Pricing";
import Problems from "@/components/HomePage/Problems";
import { CTA } from "@/components/HomePage/CTA";
import {
  ClientsProps,
  FeatureItems,
  HomePageFaqProps,
  HeroProps,
  PricingProps,
  ProblemsProps,
  SolutionProps,
} from "@/lib/props";

export default function Home() {
  return (
    <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 pt-24 md:gap-6">
      <Hero {...HeroProps} />
      <Problems {...ProblemsProps} />
      <Solution {...SolutionProps} />
      <Features {...FeatureItems} />
      <Clients {...ClientsProps} />
      <Pricing {...PricingProps} />
      <FAQ {...HomePageFaqProps} />
      <CTA />
    </main>
  );
}
