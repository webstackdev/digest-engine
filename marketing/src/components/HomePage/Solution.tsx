import Image from "next/image";

import type { ISolutionProps } from "@/lib/types";

import { PageSection } from "../Section";

/**
 * Marketing homepage solution overview section.
 */
const Solution = ({ title, description, steps }: ISolutionProps) => {
  return (
    <PageSection classes="px-8 sm:px-12 py-8 sm:py-10">
      <div className="grid gap-8 text-content-active">
        <header className="max-w-4xl space-y-4">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            {title}
          </h2>
          <p className="max-w-4xl text-lg leading-8 text-content-offset sm:text-xl">
            {description}
          </p>
        </header>

        <ol
          aria-label="How Digest Engine works"
          className="grid gap-4 md:grid-cols-2"
        >
          {steps.map((step) => (
            <li
              key={step.title}
              className="rounded-3xl border border-trim-offset bg-page-base p-6"
            >
              <div className="flex items-start gap-4">
                <Image
                  src={step.image}
                  alt="Workflow step illustration"
                  width={90}
                  height={90}
                  className="h-[90px] w-[90px] shrink-0 rounded-2xl object-cover"
                />
                <div className="space-y-3">
                  <h3 className="text-2xl font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-base leading-7 text-content-offset">
                    {step.description}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </PageSection>
  );
};

export default Solution;
