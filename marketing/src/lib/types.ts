import type { ReactNode } from "react";
import type { StaticImageData } from "next/image";

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

export interface IProblemsCard {
  title: string;
  description: string;
}

export interface IProblemsProps {
  eyebrow: string;
  title: string;
  description: string;
  toolsHeading: string;
  toolsDescription: string;
  toolFailures: IProblemsCard[];
}

export interface ISolutionStep {
  title: string;
  description: string;
  image: StaticImageData;
}

export interface ISolutionProps {
  title: string;
  description: string;
  steps: ISolutionStep[];
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
