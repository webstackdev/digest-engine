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
      <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.92),transparent_46%),radial-gradient(circle_at_bottom_right,rgba(178,201,184,0.32),transparent_36%)]' />
      <div className='relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]'>
        <div className='flex flex-col items-start gap-4 sm:gap-5'>
        {notification && (
          <div className='inline-flex flex-wrap items-center gap-2 rounded-full border border-white/70 bg-white/82 px-3 py-2 text-sm text-(--font-secondary) shadow-[0_14px_34px_rgba(62,77,107,0.08)] backdrop-blur'>
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
                className='h-12 rounded-full bg-[linear-gradient(135deg,var(--brand-fill-accent),#d17e60)] px-6 text-[15px] font-semibold text-white shadow-[0_18px_38px_rgba(198,107,82,0.28)] hover:brightness-105'
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
                className='h-12 rounded-full border-white/80 bg-white/72 px-6 text-[15px] font-semibold text-(--font-primary) shadow-[0_12px_28px_rgba(62,77,107,0.08)] backdrop-blur hover:bg-white'
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
                className='rounded-[1.4rem] border border-white/70 bg-white/72 px-4 py-4 text-sm leading-6 text-(--font-secondary) shadow-[0_16px_36px_rgba(62,77,107,0.07)] backdrop-blur'
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
          <div className='relative aspect-[1.05] overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(244,246,248,0.82))] p-6 shadow-[0_34px_70px_rgba(62,77,107,0.14)]'>
            <div className='absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(198,107,82,0.34),rgba(198,107,82,0.08)_42%,transparent_72%)]' />
            <div className='absolute left-8 top-10 rounded-[1.4rem] border border-white/80 bg-white/78 px-4 py-3 shadow-[0_16px_32px_rgba(62,77,107,0.08)] backdrop-blur'>
              <p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-(--font-secondary)'>Signals</p>
              <p className='mt-2 text-base font-semibold text-(--font-primary)'>124 new items this week</p>
            </div>
            <div className='absolute bottom-8 left-4 rounded-[1.4rem] border border-white/80 bg-white/78 px-4 py-3 shadow-[0_16px_32px_rgba(62,77,107,0.08)] backdrop-blur sm:left-8'>
              <p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-(--font-secondary)'>Shortlist</p>
              <p className='mt-2 text-base font-semibold text-(--font-primary)'>18 ranked articles ready</p>
            </div>
            <div className='absolute right-6 top-16 rounded-[1.4rem] border border-white/80 bg-white/78 px-4 py-3 shadow-[0_16px_32px_rgba(62,77,107,0.08)] backdrop-blur'>
              <p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-(--font-secondary)'>Authority</p>
              <p className='mt-2 text-base font-semibold text-(--font-primary)'>Peer-endorsed sources mapped</p>
            </div>
            <div className='absolute right-8 top-1/2 h-28 w-28 -translate-y-1/2 rounded-[2rem] border border-white/80 bg-[linear-gradient(180deg,rgba(134,166,141,0.32),rgba(255,255,255,0.88))] shadow-[0_20px_40px_rgba(62,77,107,0.08)]' />
            <div className='absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border-[12px] border-(--brand-color)/20 bg-white/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.8)]' />
            <div className='absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[linear-gradient(135deg,var(--brand-fill-accent),rgba(255,255,255,0.82))] shadow-[0_12px_24px_rgba(198,107,82,0.28)]' />
            <div className='absolute bottom-8 right-6 rounded-[1.4rem] border border-white/80 bg-white/78 px-4 py-3 shadow-[0_16px_32px_rgba(62,77,107,0.08)] backdrop-blur'>
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
