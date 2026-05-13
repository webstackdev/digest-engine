import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageSection } from "../ui/page-section";
import { PricingPlan } from "@/lib/types";

const Pricing: React.FC<{ title: string; description: string; plans: PricingPlan[]; annualDiscount: number }> = ({
  title,
  description,
  plans,
  annualDiscount,
}) => {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <PageSection name={title} description={description}>
      <div className='space-y-8'>
        <div className='flex w-full justify-center px-4'>
          <div
            className={cn(
              "marketing-glass relative flex items-center gap-3 rounded-full px-2 py-2"
            )}>
            <button
              type='button'
              className={cn(
                "relative flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors",
                isYearly ? "text-primary" : "text-muted-foreground"
              )}
              onClick={() => setIsYearly(true)}>
              {isYearly && (
                <span className='marketing-glass-strong absolute inset-0 -z-10 rounded-full' />
              )}
              Yearly
              <span className='text-(--brand-fill-secondary-strong)'>Save {annualDiscount}%</span>
            </button>
            <button
              type='button'
              className={cn(
                "relative flex items-center rounded-full px-5 py-2 text-sm font-semibold transition-colors",
                !isYearly ? "text-foreground" : "text-muted-foreground"
              )}
              onClick={() => setIsYearly(false)}>
              {!isYearly && (
                <span className='marketing-glass-strong absolute inset-0 -z-10 rounded-full' />
              )}
              Monthly
            </button>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-4 lg:grid-cols-4'>
            {plans.map((plan) => {
              const buttonClass = plan.isPopular
                ? "marketing-accent-button text-[var(--brand-fill-accent-contrast)]"
                : "marketing-secondary-button text-primary";

              return (
                <div
                  key={plan.name}
                  className={cn(
                    "flex h-full flex-col gap-8 rounded-[1.9rem] border p-7 transition-transform duration-200 hover:-translate-y-1 sm:p-8",
                    plan.isPopular
                      ? "marketing-card-accent"
                      : "marketing-card"
                  )}>
                  <div className='space-y-6'>
                    <div className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <p className='text-sm font-semibold uppercase tracking-[0.24em] text-(--font-secondary)'>{plan.name}</p>
                        {plan.isPopular && (
                          <span className='rounded-full bg-(--brand-surface-accent) px-2.5 py-1 text-xs font-semibold text-(--brand-fill-accent-strong)'>
                            Popular
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className='text-4xl font-semibold tracking-tight text-foreground'>
                          ${isYearly ? Math.round(plan.monthlyPrice * (1 - annualDiscount / 100)) : plan.monthlyPrice}
                          <span className='text-base font-medium text-muted-foreground'>/mo</span>
                        </h3>
                      </div>
                    </div>

                    <p className='text-sm leading-7 text-muted-foreground'>{plan.description}</p>

                    <div>
                      <ul className='mt-4 space-y-3 text-sm'>
                        {plan.features.map((feature) => {
                          const [value, ...rest] = feature.split(" ");
                          return (
                            <li key={feature} className='flex items-start gap-3'>
                              <svg
                                className='mt-1 h-4 w-4 shrink-0 text-(--brand-fill-secondary-strong)'
                                viewBox='0 0 20 20'
                                fill='currentColor'
                              >
                                <path
                                  fillRule='evenodd'
                                  d='M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25a1 1 0 111.414-1.414L8.75 11.586l6.543-6.543a1 1 0 011.414 0z'
                                  clipRule='evenodd'
                                />
                              </svg>
                              <span className='text-muted-foreground'>
                                <span className='font-semibold text-foreground'>{value}</span> {rest.join(" ")}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>

                  <Button
                    variant={plan.buttonVariant}
                    className={cn(
                      "mt-auto h-12 w-full rounded-full border-transparent text-base font-semibold transition-colors",
                      buttonClass
                    )}
                  >
                    {plan.buttonLabel}
                  </Button>
                </div>
              );
            })}
        </div>
      </div>
    </PageSection>
  );
};
export default Pricing;
