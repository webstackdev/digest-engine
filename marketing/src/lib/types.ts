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

export interface IFeatureItem {
  title: string;
  description: string;
  image: StaticImageData;
  link: string;
}

export interface IFeaturesProps {
  title: string;
  description: string;
  items: IFeatureItem[];
}

export interface IIntegrationItem {
  label: string;
  description: string;
}

export interface IClientsProps {
  title: string;
  description: string;
  badge: string;
  items: IIntegrationItem[];
}

export interface IHomePageFaqItem {
  question: string;
  answer: ReactNode;
}

export interface IHomePageFaqProps {
  eyebrow: string;
  title: string;
  description: string;
  items: IHomePageFaqItem[];
}

export interface IPricingFeatureMatrixRow {
  feature: string;
  values: string[];
}

export interface IPricingFaqItem {
  question: string;
  answer: string;
}

export interface IPricingPageProps {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  matrixHeading: string;
  matrixDescription: string;
  matrixColumns: string[];
  matrixRows: IPricingFeatureMatrixRow[];
  faqHeading: string;
  faqDescription: string;
  faqs: IPricingFaqItem[];
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
