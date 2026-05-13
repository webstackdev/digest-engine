"use client";

import { FC, ReactNode } from "react";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

import { Button } from "../ui/button";

const Hero: FC<{
  notification?: {
    tag?: string;
    description: string;
  };
  title: string;
  description: string;
  btnGetStarted?: {
    text: string;
    link: string;
  };
  btnBookDemo?: {
    text: string;
    link: string;
  };
  extraDescription?: string;
  extraContent?: ReactNode;
}> = ({ notification, description, title, btnGetStarted, btnBookDemo, extraDescription, extraContent }) => {
  const highlights = [
    "Project-scoped relevance",
    "Authority scoring from peer newsletters",
    "Human review before anything important ships",
  ];

  return (
    <section
      id='about'
      className='marketing-panel relative overflow-hidden rounded-[2rem] px-6 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-14'
    >
      <div className='absolute inset-0 bg-[var(--brand-surface-secondary)] opacity-40' />
      <div className='relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]'>
        <div className='flex flex-col items-start gap-4 sm:gap-5'>
        {notification && (
          <div className='marketing-glass-strong inline-flex flex-wrap items-center gap-2 rounded-full px-3 py-2 text-sm text-(--font-secondary)'>
            {notification.tag && notification.tag.trim() !== "" && (
              <span className='rounded-full bg-(--bg-selected-menu) px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-(--font-primary)'>
                {notification.tag}
              </span>
            )}

            <span>{notification.description}</span>
          </div>
        )}

          <div className='space-y-4'>
            <h1 className='max-w-[12ch] text-4xl font-semibold leading-[0.94] tracking-tight text-(--font-primary) sm:text-5xl lg:text-6xl'>
              {title}
            </h1>
            <p className='max-w-2xl text-base leading-7 text-(--font-secondary) sm:text-lg'>
          {description}
        </p>
          </div>

          <div className='flex w-full flex-col items-start gap-3 pt-2 sm:flex-row'>
          {btnGetStarted && btnGetStarted.text.trim() !== "" && (
            <a href={btnGetStarted.link} className='w-full sm:w-auto'>
              <Button
                variant='default'
                size='lg'
                className='marketing-accent-button h-12 rounded-full px-6 text-[15px] font-semibold transition-colors'
              >
                {btnGetStarted.text}
              </Button>
            </a>
          )}
          {btnBookDemo && btnBookDemo.text.trim() !== "" && (
            <a href={btnBookDemo.link} className='w-full sm:w-auto'>
              <Button
                variant='outline'
                size='lg'
                className='marketing-secondary-button h-12 rounded-full px-6 text-[15px] font-semibold transition-colors'
              >
                {btnBookDemo.text}
              </Button>
            </a>
          )}
        </div>

          <div className='grid gap-3 pt-3 sm:grid-cols-3'>
            {highlights.map((highlight) => (
              <div
                key={highlight}
                className='marketing-glass rounded-[1.4rem] px-4 py-4 text-sm leading-6 text-(--font-secondary)'
              >
                {highlight}
              </div>
            ))}
          </div>

        {extraDescription && extraDescription.trim() !== "" && (
            <p className='inline-flex items-center gap-2 text-sm font-medium text-(--font-secondary)'>
              <ArrowRightIcon className='h-4 w-4 text-(--brand-color)' />
              {extraDescription}
            </p>
        )}

          {extraContent ? <div className='w-full'>{extraContent}</div> : null}
        </div>

        <div className='relative mx-auto w-full max-w-[480px]'>
          <div className='marketing-card-strong relative aspect-[1.05] overflow-hidden rounded-[2rem] p-6'>
            <div className='absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brand-accent-wash)] blur-3xl' />
            <div className='marketing-glass absolute left-8 top-10 rounded-[1.4rem] px-4 py-3'>
              <p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-(--font-secondary)'>Signals</p>
              <p className='mt-2 text-base font-semibold text-(--font-primary)'>124 new items this week</p>
            </div>
            <div className='marketing-glass absolute bottom-8 left-4 rounded-[1.4rem] px-4 py-3 sm:left-8'>
              <p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-(--font-secondary)'>Shortlist</p>
              <p className='mt-2 text-base font-semibold text-(--font-primary)'>18 ranked articles ready</p>
            </div>
            <div className='marketing-glass absolute right-6 top-16 rounded-[1.4rem] px-4 py-3'>
              <p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-(--font-secondary)'>Authority</p>
              <p className='mt-2 text-base font-semibold text-(--font-primary)'>Peer-endorsed sources mapped</p>
            </div>
            <div className='absolute right-8 top-1/2 h-28 w-28 -translate-y-1/2 rounded-[2rem] border border-[var(--brand-border-bright)] bg-[var(--brand-surface-secondary)] shadow-[var(--brand-shadow-soft)]' />
            <div className='absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border-[12px] border-[var(--brand-accent-border)] bg-[var(--brand-surface-overlay)] shadow-[var(--brand-shadow-inset)]' />
            <div className='absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brand-fill-accent-soft)] shadow-[var(--brand-shadow-accent)]' />
            <div className='marketing-glass absolute bottom-8 right-6 rounded-[1.4rem] px-4 py-3'>
              <p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-(--font-secondary)'>Draft</p>
              <p className='mt-2 text-base font-semibold text-(--font-primary)'>Themes assembled for the next issue</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
