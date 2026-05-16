import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Blocks,
  BrainCircuit,
  CheckCircle2,
  FileSearch,
  Layers3,
  MessageSquareQuote,
  Sparkles,
} from "lucide-react";

import { CTA } from "@/components/HomePage/CTA";
import { PageSection } from "@/components/Section";
import { Button } from "@/components/shared/button";
import { brand } from "@/lib/props";

const tourSteps = [
  {
    title: "Ingest the sources that already matter",
    description:
      "Bring in newsletters, RSS feeds, websites, and internal sources without forcing every team into the same editorial workflow.",
    icon: Layers3,
  },
  {
    title: "Score what matters per project",
    description:
      "Digest Engine ranks relevance against each project's goals, so the strongest signals rise without burying niche but important work.",
    icon: BrainCircuit,
  },
  {
    title: "Review, refine, and publish with context",
    description:
      "Editors keep the final say with transparent summaries, entity context, review queues, and handoff-ready outputs.",
    icon: CheckCircle2,
  },
];

const tourCapabilities = [
  {
    title: "Project-aware ranking",
    description:
      "Each team can train relevance independently instead of sharing one generic scoring model.",
    icon: Sparkles,
  },
  {
    title: "Human review by default",
    description:
      "The workflow surfaces confidence and uncertainty so editors can intervene before anything ships.",
    icon: MessageSquareQuote,
  },
  {
    title: "Composable AI skills",
    description:
      "Classification, summarization, extraction, and scoring can be mixed without locking you into one model stack.",
    icon: Blocks,
  },
  {
    title: "Traceable source context",
    description:
      "Every recommendation can be tied back to source material, entities, and ranking evidence.",
    icon: FileSearch,
  },
];

export const metadata: Metadata = {
  title: `${brand.name} Tour`,
  description: "A quick walkthrough of how Digest Engine ingests, ranks, reviews, and turns source material into editorial output.",
};

export default function TourPage() {
  return (
    <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 pt-24 md:gap-6">
      <PageSection id="tour-hero" classes="px-6 py-10 sm:px-10 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
          <div className="flex flex-col gap-6">
            <span className="w-fit rounded-full border border-trim-offset bg-page-base px-4 py-2 text-sm font-medium text-content-offset shadow-soft backdrop-blur-[18px]">
              Product tour
            </span>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-primary sm:text-5xl lg:text-6xl">
                See how {brand.name} turns raw signals into editorial-ready intelligence.
              </h1>

              <p className="max-w-2xl text-lg leading-8 text-content-active">
                This is the fast walk-through: sources come in, AI ranks and enriches them per project,
                editors review the results, and teams publish with more context and less manual triage.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                variant="default"
                size="lg"
                className="h-12 rounded-full bg-accent px-6 text-lg font-semibold text-primary-inverse transition-colors hover:bg-accent-offset"
              >
                <Link href="/signup">Start Your First Project</Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 rounded-full px-6 text-lg font-semibold"
              >
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-4xl border border-trim-offset bg-page-base p-6 shadow-card backdrop-blur-[18px]">
            <p className="text-sm font-semibold uppercase tracking-widest text-content-offset">
              What teams get
            </p>
            <div className="mt-5 space-y-4">
              {[
                "One intake layer for newsletters, feeds, and web sources.",
                "Relevance tuned to each project instead of one global ranking.",
                "Clear review checkpoints before summaries or outputs go live.",
                "Entity-aware context that helps stories connect across time.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-3xl border border-trim-offset bg-background p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                  <p className="text-base leading-7 text-content-active">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageSection>

      <PageSection id="tour-flow" classes="px-6 py-8 sm:px-8 sm:py-10">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
            Workflow
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content-active sm:text-3xl">
            Three stages from source intake to finished output.
          </h2>
          <p className="mt-3 text-base leading-7 text-content-offset">
            The platform is designed to reduce repetitive triage without hiding the editorial reasoning.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {tourSteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <article
                key={step.title}
                className="rounded-3xl border border-trim-offset bg-page-base p-6 shadow-card"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-background text-content-active">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-content-offset">0{index + 1}</span>
                </div>

                <h3 className="mt-6 text-xl font-semibold tracking-tight text-content-active">
                  {step.title}
                </h3>
                <p className="mt-3 text-base leading-7 text-content-offset">{step.description}</p>
              </article>
            );
          })}
        </div>
      </PageSection>

      <PageSection id="tour-capabilities" classes="px-6 py-8 sm:px-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
              Capabilities
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content-active sm:text-3xl">
              Built for teams that need stronger signals, not just more summaries.
            </h2>
            <p className="mt-3 text-base leading-7 text-content-offset">
              The tour page is intentionally compact, but these are the patterns that tend to matter most in production.
            </p>

            <Link
              href="/docs/reference/overview"
              className="mt-6 inline-flex items-center gap-2 text-base font-semibold text-content-active transition-colors hover:text-content-offset"
            >
              Explore the docs
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {tourCapabilities.map((capability) => {
              const Icon = capability.icon;

              return (
                <article
                  key={capability.title}
                  className="rounded-3xl border border-trim-offset bg-page-base p-6 shadow-card"
                >
                  <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-background text-content-active">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-content-active">
                    {capability.title}
                  </h3>
                  <p className="mt-3 text-base leading-7 text-content-offset">
                    {capability.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </PageSection>

      <CTA />
    </main>
  );
}
