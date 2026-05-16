import { ChevronDown } from "lucide-react";
import { FC } from "react";

import type { IHomePageFaqProps } from "@/lib/types";

import { PageSection } from "../Section";

const FAQ: FC<IHomePageFaqProps> = ({ eyebrow, title, description, items }) => {
  return (
    <PageSection id="faq" classes="px-6 py-8 sm:px-8 sm:py-10">
      <div className="w-full">
        <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content-active sm:text-3xl">
          {title}
        </h2>
        <p className="mt-3 text-base leading-7 text-content-offset">
          {description}
        </p>
      </div>

      <div className="mt-8 w-full space-y-3">
        {items.map((item) => (
          <details
            key={item.question}
            className="group block w-full rounded-3xl border border-trim-offset bg-page-base px-5 py-4 shadow-card transition-colors open:bg-secondary"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left [&::-webkit-details-marker]:hidden">
              <span className="text-lg font-semibold tracking-tight text-content-active">
                {item.question}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="mt-1 size-5 shrink-0 text-content-offset transition-transform duration-300 group-open:rotate-180"
              />
            </summary>

            <div className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-300 ease-out group-open:grid-rows-[1fr] group-open:opacity-100">
              <div className="overflow-hidden">
                <div className="border-t border-trim-offset pt-4 text-base leading-7 text-content-offset [&_code]:rounded-md [&_code]:border [&_code]:border-trim-offset [&_code]:bg-page-base [&_code]:px-1.5 [&_code]:py-0.5 [&_ol]:space-y-3 [&_strong]:text-content-active [&_ul]:space-y-3">
                  {item.answer}
                </div>
              </div>
            </div>
          </details>
        ))}
      </div>
    </PageSection>
  );
};

export default FAQ;