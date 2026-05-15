import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Orbit, PanelsTopLeft, ShieldCheck } from "lucide-react";

import { PageSection } from "@/components/Section";
import { Button } from "@/components/shared/button";
import { brand } from "@/lib/props";

const docsHighlights = [
  {
    title: "User Guide",
    description: "Start with the day-to-day workflow for projects, sources, queues, and the editorial loop inside Digest Engine.",
    icon: PanelsTopLeft,
    href: "/docs/user-guide/overview",
  },
  {
    title: "Developer Guide",
    description: "Understand how ingestion, ranking, review queues, and drafting fit together before you wire the system into your stack.",
    icon: Orbit,
    href: "/docs/developer-guide/overview",
  },
  {
    title: "Reference",
    description: "Use the deeper MDX docs for implementation details while this landing page stays focused on orientation and navigation.",
    icon: BookOpen,
    href: "/docs/reference/overview",
  },
  {
    title: "Admin Guide",
    description: "Go straight to installation, configuration, operations, and access management when you are running the platform.",
    icon: ShieldCheck,
    href: "/docs/admin-guide/overview",
  },
] as const;

export const metadata: Metadata = {
  title: `${brand.name} Docs`,
  description: "Product documentation, implementation notes, and architecture guidance for Digest Engine.",
};

export default function DocsHomePage() {
  return (
    <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 pt-24 md:gap-6">
      <PageSection id="docs-home" classes="px-6 py-10 sm:px-10 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.85fr)] lg:items-start">
          <div className="flex flex-col gap-6">
            <span className="w-fit rounded-full border border-trim-offset bg-page-base px-4 py-2 text-sm font-medium text-content-offset shadow-soft backdrop-blur-[18px]">
              Documentation
            </span>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-primary sm:text-5xl lg:text-6xl">
                A dedicated docs landing page for the builders using {brand.name}.
              </h1>

              <p className="max-w-2xl text-lg leading-8 text-content-active">
                This route is now a custom entry point instead of the root MDX document, so you can style /docs separately from the deeper reference pages.
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
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {docsHighlights.map(({ title, description, icon: Icon, href }) => (
              <Link
                key={title}
                href={href}
                className="block rounded-3xl border border-trim-offset bg-page-base p-6 shadow-card backdrop-blur-[18px] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-card-strong"
              >
                <article>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-trim-offset bg-secondary text-primary shadow-soft">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight text-primary">{title}</h2>
                  <p className="mt-3 text-base leading-7 text-content-active">{description}</p>
                </article>
              </Link>
            ))}
          </div>
        </div>
      </PageSection>
    </main>
  );
}
