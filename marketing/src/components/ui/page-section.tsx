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
          <span className='marketing-glass-strong rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--font-secondary)'>
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
