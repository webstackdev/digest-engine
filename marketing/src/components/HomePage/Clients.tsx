import { FC } from "react";

const Clients: FC<{
  title: string;
  description: string;
  items: { label: string; eyebrow: string }[];
}> = ({ title, description, items }) => {
  return (
    <section
      id="integrations"
      className="rounded-display border border-border bg-card px-6 py-8 shadow-panel backdrop-blur-[18px] sm:px-8 sm:py-10"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-2xs font-semibold uppercase tracking-section text-muted-foreground">
            Sources and stack
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="rounded-full border border-border bg-secondary px-4 py-2 text-sm font-medium text-muted-foreground shadow-soft backdrop-blur-[18px]">
          Project-scoped from ingest to draft
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-tile border border-border bg-card px-4 py-4 shadow-soft backdrop-blur-[18px] transition-transform duration-200 hover:-translate-y-0.5"
          >
            <p className="text-3xs font-semibold uppercase tracking-overline text-muted-foreground">
              {item.eyebrow}
            </p>
            <p className="mt-3 text-lg font-semibold text-foreground">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Clients;
