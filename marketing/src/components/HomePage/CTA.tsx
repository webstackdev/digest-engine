import { PageSection } from "../Section";
import { Button } from "../shared/button";

export const CTA = () => {
  return (
    <PageSection>
      <div className="relative overflow-hidden rounded-display border border-brand-border-bright bg-card px-6 py-10 shadow-brand-panel backdrop-blur-[18px] sm:px-8 sm:py-12">
        <div className="absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 rounded-full bg-brand-sage-wash blur-3xl" />
        <div className="absolute bottom-0 right-10 h-40 w-40 rounded-full bg-brand-accent-wash blur-3xl" />
        <div className="relative flex flex-col items-center justify-center gap-4 px-4 text-center sm:px-6 lg:px-8">
          <span className="rounded-full border border-brand-border-bright bg-brand-surface-overlay px-3 py-1 text-2xs font-semibold uppercase tracking-overline text-muted-foreground shadow-brand-soft backdrop-blur-[18px]">
            Get started
          </span>
          <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Spend the next four hours writing, not scrolling.
          </h2>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Start with the open-source stack, train one project against your
            editorial taste, and let the next issue begin from a ranked
            shortlist instead of a blank page.
          </p>
          <Button className="mt-2 h-12 rounded-full bg-brand-fill-accent-soft px-7 text-base font-semibold text-brand-fill-accent-contrast transition-colors hover:bg-brand-fill-accent">
            Explore Digest Engine
          </Button>
          <p className="text-sm text-muted-foreground">
            Open source. Self-hostable. Built for editors, not ML engineers.
          </p>
        </div>
      </div>
    </PageSection>
  );
};
