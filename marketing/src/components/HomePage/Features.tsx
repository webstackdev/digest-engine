import { FC, ReactNode } from "react";
import { PageSection } from "../ui/page-section";

const FeatureCard: FC<{ title: string; icon: ReactNode; description: string; link: string }> = ({ title, icon, description }) => {
  return (
    <article className='group relative flex h-full flex-col gap-5 rounded-[1.75rem] border border-white/72 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(243,246,244,0.84))] p-6 shadow-[0_22px_44px_rgba(62,77,107,0.08)] transition-transform duration-200 hover:-translate-y-1'>
      <div className='flex items-start justify-between gap-4'>
        <div className='rounded-2xl border border-white/80 bg-white/84 px-3 py-2 text-(--brand-color) shadow-[0_10px_20px_rgba(62,77,107,0.06)]'>
          {icon}
        </div>
        <span className='text-xs font-semibold uppercase tracking-[0.24em] text-(--font-secondary)'>Feature</span>
      </div>

      <div className='space-y-3'>
        <h3 className='text-xl font-semibold tracking-tight text-(--font-primary) sm:text-2xl'>{title}</h3>
        <p className='m-0 text-base leading-7 text-(--font-secondary)'>{description}</p>
      </div>

      <div className='mt-auto pt-2 text-sm font-semibold text-(--brand-color)'>Explore capability</div>
    </article>
  );
};
const Features: FC<{
  title: string;
  description: string;
  items: { title: string; icon: ReactNode; description: string; link: string }[];
}> = ({ title, description, items }) => {
  return (
    <PageSection name={title} description={description}>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {items.map((props, idx) => {
          return (
            <div key={idx} className='h-full'>
              <FeatureCard {...props} />
            </div>
          );
        })}
      </div>
    </PageSection>
  );
};

export default Features;
