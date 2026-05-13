import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import type { IPageSectionProps, SectionTag } from "@/lib/types";

type Props<T extends SectionTag> = IPageSectionProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof IPageSectionProps<T>>;

export const PageSection = <T extends SectionTag = "section">({
  as,
  id,
  classes,
  children,
  ...props
}: Props<T>) => {
  const Component = as || "section";

  return (
    <Component
      id={id}
      className={cn(
        "mx-auto max-w-marketing px-4 sm:px-6",
        "rounded-display",
        "border border-brand-border-bright",
        "bg-brand-surface-overlay-strong shadow-brand-soft backdrop-blur-[18px]",
        classes,
      )}
      {...props}
    >
      {children}
    </Component>
  );
};
