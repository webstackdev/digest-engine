import Link from "next/link";

import { PageSection } from "../Section";
import { Button } from "../shared/button";

export const CTA = () => {
  return (
    <PageSection
      id="cta"
      aria-label="Homepage call to action"
      classes="px-6 py-8 sm:px-8 sm:py-10"
    >
      <div className="relative flex w-full flex-col items-center justify-center gap-4 text-center">
        <span className="rounded-full border border-trim-offset bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-widest text-content-offset shadow-soft backdrop-blur-[18px]">
          Start your first project
        </span>
        <h2 className="w-full text-3xl font-semibold tracking-tight text-content-active sm:text-4xl md:text-5xl">
          Turn scattered feeds into a shortlist you can trust.
        </h2>
        <p className="w-full text-base leading-7 text-content-offset sm:text-lg">
          Connect the sources you already trust, train one project on your
          editorial taste, and let the next issue start with ranked content,
          summaries, and a draft outline instead of a pile of tabs.
        </p>
        <Button
          asChild
          className="mt-2 h-12 rounded-full bg-primary px-7 text-base font-semibold text-primary-inverse transition-colors hover:bg-primary"
        >
          <Link href="/signup">Start Your First Project</Link>
        </Button>
        <p className="text-sm text-content-offset">
          Open source. Self-hostable. Hosted access coming soon.
        </p>
      </div>
    </PageSection>
  );
};
