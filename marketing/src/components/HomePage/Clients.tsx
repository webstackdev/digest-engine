import { FC } from "react";

import type { IClientsProps } from "@/lib/types";

const Clients: FC<IClientsProps> = ({ title, description, badge, items }) => {
  return (
    <section
      id="integrations"
      className="rounded-4xl border border-trim-offset bg-page-base px-6 py-8 shadow-panel backdrop-blur-[18px] sm:px-8 sm:py-10"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
            Integrations
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content-active sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 text-base leading-7 text-content-offset">
            {description}
          </p>
        </div>
        <div className="rounded-full border border-trim-offset bg-secondary px-4 py-2 text-sm font-medium text-content-offset shadow-soft backdrop-blur-[18px]">
          {badge}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-3xl border border-trim-offset bg-page-base px-4 py-4 shadow-soft backdrop-blur-[18px] transition-transform duration-200 hover:-translate-y-0.5"
          >
            <h3 className="text-lg font-semibold text-content-active">
              {item.label}
            </h3>
            <p className="mt-3 text-sm leading-6 text-content-offset">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Clients;
