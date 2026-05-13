import { FC } from "react";

const Companies: FC<{
  title: string;
  description: string;
  items: { label: string; eyebrow: string }[];
}> = ({ title, description, items }) => {

  return (
    <section className='marketing-panel rounded-[2rem] px-6 py-8 sm:px-8 sm:py-10'>
      <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
        <div className='max-w-2xl'>
          <p className='text-[11px] font-semibold uppercase tracking-[0.28em] text-(--font-secondary)'>Sources and stack</p>
          <h2 className='mt-3 text-2xl font-semibold tracking-tight text-(--font-primary) sm:text-3xl'>{title}</h2>
          <p className='mt-3 text-base leading-7 text-(--font-secondary)'>{description}</p>
        </div>
        <div className='marketing-glass rounded-full px-4 py-2 text-sm font-medium text-(--font-secondary)'>
          Project-scoped from ingest to draft
        </div>
      </div>

      <div className='mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
        {items.map((item) => (
          <div
            key={item.label}
            className='marketing-glass rounded-[1.5rem] px-4 py-4 transition-transform duration-200 hover:-translate-y-0.5'
          >
            <p className='text-[10px] font-semibold uppercase tracking-[0.24em] text-(--font-secondary)'>{item.eyebrow}</p>
            <p className='mt-3 text-lg font-semibold text-(--font-primary)'>{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Companies;
