import { PageSection } from "../ui/page-section";
import { Button } from "../ui/button";

export const CTA = () => {
  return (
    <PageSection>
      <div className='marketing-panel relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-8 sm:py-12'>
        <div className='absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(134,166,141,0.26),transparent_68%)]' />
        <div className='absolute bottom-0 right-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(198,107,82,0.18),transparent_70%)]' />
        <div className='relative flex flex-col items-center justify-center gap-4 px-4 text-center sm:px-6 lg:px-8'>
          <span className='rounded-full border border-white/70 bg-white/76 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--font-secondary) shadow-[0_12px_26px_rgba(62,77,107,0.08)]'>
            Get started
          </span>
          <h2 className='max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl'>
            Spend the next four hours writing, not scrolling.
          </h2>
          <p className='max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg'>
            Start with the open-source stack, train one project against your editorial taste, and let the next issue begin from a ranked shortlist instead of a blank page.
          </p>
          <Button className='mt-2 h-12 rounded-full bg-[linear-gradient(135deg,var(--brand-fill-accent),#d17e60)] px-7 text-base font-semibold text-white shadow-[0_18px_38px_rgba(198,107,82,0.28)] hover:brightness-105'>
            Explore Digest Engine
          </Button>
          <p className='text-sm text-(--font-secondary)'>Open source. Self-hostable. Built for editors, not ML engineers.</p>
        </div>
      </div>
    </PageSection>
  );
};
