import type { ReactNode } from "react";

export type SectionTag = "section" | "header" | "footer";

export interface IPageSectionProps<T extends SectionTag> {
  as?: T;
  id?: string;
  classes?: string;
  shadowClass?: string;
  children: ReactNode;
}

export interface IHeroProps {
  title: string;
  description: string;
  btnGetStarted?: {
    text: string;
    link: string;
  };
}

export interface IPricingPlan {
  name: string;
  monthlyPrice: number;
  description: string;
  features: string[];
  buttonLabel: string;
  buttonVariant: "default" | "outline";
  isPopular: boolean;
}

export interface IPricingProps {
  title: string;
  description: string;
  annualDiscount: number;
  plans: IPricingPlan[];
}
