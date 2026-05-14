import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import type { IPageSectionProps, SectionTag } from "@/lib/types";

type Props<T extends SectionTag> = IPageSectionProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof IPageSectionProps<T>>;

export const PageSection = <T extends SectionTag = "section">({
  as,
  id,
  classes,
  shadowClass = "shadow-panel",
  children,
  ...props
}: Props<T>) => {
  const Component = as || "section";

  return (
    <Component
      id={id}
      className={cn(
        "relative overflow-hidden",
        "mx-auto max-w-6xl px-4 sm:px-6",
        "rounded-4xl bg-page-offset",
        shadowClass,
        "backdrop-blur-[18px]",
        classes,
      )}
      {...props}
    >
      {children}
    </Component>
  );
};
