"use client";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

import { brand } from "@/lib/props";
// A natural next step would be to give marketing/src/app/global-error.tsx the same visual treatment so the 404 and error fallback feel like a matched pair.
/**
 * Renders the top-level fallback UI for uncaught App Router errors.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className='bg-page-base px-4 text-content-active'>
        <GlobalErrorContent error={error} reset={reset} />
      </body>
    </html>
  );
}

type GlobalErrorContentProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Renders the branded recovery UI and reports the failure to Sentry.
 */
export function GlobalErrorContent({
  error,
  reset,
}: GlobalErrorContentProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className='mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 py-16 text-center'>
      <div className='space-y-4'>
        <p className='text-sm font-semibold uppercase tracking-widest text-primary'>
          Error
        </p>
        <h1 className='text-4xl font-semibold tracking-tight text-content-active'>
          {brand.name} hit an unexpected problem
        </h1>
        <p className='max-w-2xl text-base text-content-offset'>
          We logged the failure and you can retry this page now or head back to the homepage.
        </p>
        {error.digest ? (
          <p className='text-sm text-content-offset'>Reference: {error.digest}</p>
        ) : null}
      </div>
      <div className='flex flex-col items-center gap-3 sm:flex-row'>
        <button
          type='button'
          onClick={reset}
          className='rounded-full bg-secondary px-5 py-3 text-sm font-medium text-content-active transition-colors hover:bg-accent'
        >
          Try again
        </button>
        <Link
          href='/'
          className='rounded-full border border-trim-offset px-5 py-3 text-sm font-medium text-content-active transition-colors hover:border-content-offset hover:bg-background'
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
