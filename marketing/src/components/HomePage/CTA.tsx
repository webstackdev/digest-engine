import { PageSection } from "../ui/page-section";
import { Button } from "../ui/button";

export const CTA = () => {
  return (
    <PageSection>
      <div className='marketing-panel relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-8 sm:py-12'>
        <div className='absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 rounded-full bg-[var(--brand-sage-wash)] blur-3xl' />
        <div className='absolute bottom-0 right-10 h-40 w-40 rounded-full bg-[var(--brand-accent-wash)] blur-3xl' />
        <div className='relative flex flex-col items-center justify-center gap-4 px-4 text-center sm:px-6 lg:px-8'>
          <span className='marketing-glass rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--font-secondary)'>
            Get started
          </span>
          <h2 className='max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl'>
            Spend the next four hours writing, not scrolling.
          </h2>
          <p className='max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg'>
            Start with the open-source stack, train one project against your editorial taste, and let the next issue begin from a ranked shortlist instead of a blank page.
          </p>
          <Button className='marketing-accent-button mt-2 h-12 rounded-full px-7 text-base font-semibold transition-colors'>
            Explore Digest Engine
          </Button>
          <p className='text-sm text-(--font-secondary)'>Open source. Self-hostable. Built for editors, not ML engineers.</p>
        </div>
      </div>
    </PageSection>
  );
};
