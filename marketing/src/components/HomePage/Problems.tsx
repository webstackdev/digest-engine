import Image from "next/image";

import problemImage from "@/assets/images/problem.png";
import type { IProblemsProps } from "@/lib/types";

import { PageSection } from "../Section";

/**
 * Marketing homepage problem framing section.
 */
const Problems = ({
  eyebrow,
  title,
  description,
  toolsHeading,
  toolsDescription,
  toolFailures,
}: IProblemsProps) => {
  return (
    <PageSection classes="px-8 sm:px-12 pt-8 sm:pt-12 pb-4 sm:pb-10">
      <div className="grid gap-10 text-content-active">
        <header className="flex gap-12">
          <div className="overflow-hidden rounded-3xl">
            <Image
              src={problemImage}
              alt="Editorial workflow comparison illustration"
              width={704}
              height={528}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <div className="space-y-3">
            <p className="text-base font-semibold uppercase tracking-wider text-secondary">
              {eyebrow}
            </p>
            <h2 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              {title}
            </h2>
            <p className="max-w-3xl text-lg leading-8 text-content-offset sm:text-xl">
              {description}
            </p>
          </div>
        </header>

        <section className="rounded-3xl border border-trim-offset bg-page-base p-6 sm:p-8">
          <div className="grid gap-8">
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {toolsHeading}
              </h3>
              <p className="text-base leading-7 text-content-offset sm:text-lg">
                {toolsDescription}
              </p>
            </div>

            <ul
              aria-label="Curation tool gaps"
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {toolFailures.map((item, index) => (
                <li
                  key={item.title}
                  className="h-full rounded-2xl border border-trim-offset bg-page-offset p-5"
                >
                  <p className="text-sm font-semibold uppercase tracking-wider text-secondary">
                    Gap 0{index + 1}
                  </p>
                  <h4 className="mt-4 text-xl font-semibold tracking-tight">
                    {item.title}
                  </h4>
                  <p className="mt-3 text-sm leading-7 text-content-offset">
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </PageSection>
  );
};

export default Problems;
