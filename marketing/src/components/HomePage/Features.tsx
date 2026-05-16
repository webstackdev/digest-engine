import Link from "next/link";
import Image from "next/image";
import { FC } from "react";

import type { IFeatureItem, IFeaturesProps } from "@/lib/types";

import { PageSection } from "../Section";

const FeatureCard: FC<IFeatureItem> = ({ title, image, description, link }) => {
  return (
    <Link href={link} className="block h-full">
      <article className="group relative flex h-full flex-col gap-5 rounded-3xl border border-trim-offset bg-page-base p-6 shadow-card transition-transform duration-200 hover:-translate-y-1">
        <div className="flex items-start justify-between gap-4">
          <Image
            src={image}
            alt="Feature illustration"
            width={90}
            height={90}
            className="h-[90px] w-[90px] rounded-2xl border border-trim-offset object-cover shadow-soft"
          />
          <span className="text-xs font-semibold uppercase tracking-widest text-content-offset">
            Feature
          </span>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold tracking-tight text-content-active sm:text-2xl">
            {title}
          </h3>
          <p className="m-0 text-base leading-7 text-content-offset">
            {description}
          </p>
        </div>

        <div className="mt-auto pt-2 text-sm font-semibold text-primary">
          Explore capability
        </div>
      </article>
    </Link>
  );
};

const Features: FC<IFeaturesProps> = ({ title, description, items }) => {
  return (
    <PageSection id="features" classes="px-6 py-8 sm:px-8 sm:py-10">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
          Capabilities
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content-active sm:text-3xl">
          {title}
        </h2>
        <p className="mt-3 text-base leading-7 text-content-offset">
          {description}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((props, idx) => {
          return (
            <div key={idx} className="h-full">
              <FeatureCard {...props} />
            </div>
          );
        })}
      </div>
    </PageSection>
  );
};

export default Features;
