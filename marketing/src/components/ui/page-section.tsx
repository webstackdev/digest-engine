import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const PageSection: React.FC<{ name?: string; description?: string; isLastSection?: boolean; children: ReactNode }> = ({
  name,
  description,
  children,
}) => {
  return (
    <section className={cn("space-y-6 sm:space-y-8")}>
      {name && description && (
        <div className='mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 text-center sm:px-6'>
          <span className='rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--font-secondary) shadow-[0_12px_26px_rgba(62,77,107,0.08)] backdrop-blur'>
            Overview
          </span>
          <h2 className='text-3xl font-semibold tracking-tight text-foreground sm:text-4xl'>{name}</h2>
          <p className='max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg'>{description}</p>
        </div>
      )}
      <div>{children}</div>
    </section>
  );
};
