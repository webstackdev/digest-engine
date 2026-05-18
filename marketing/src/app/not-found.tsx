import Image from "next/image";
import Link from "next/link";

import notFoundImage from "@/assets/images/404.jpg";

const recoveryLinks = [
  {
    href: "/tour",
    label: "How It Works",
    description: "See how Digest Engine ranks, summarizes, and drafts from your source mix.",
  },
  {
    href: "/pricing",
    label: "Pricing",
    description: "Compare the open-source and hosted paths before you jump back in.",
  },
  {
    href: "/docs",
    label: "Docs",
    description: "Browse setup guides, product notes, and the current platform capabilities.",
  },
  {
    href: "/signup",
    label: "Sign Up",
    description: "Start a project request if you were trying to evaluate the product.",
  },
];

export default function NotFound() {
  return (
    <main className='mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 pb-16 pt-32 sm:pt-36'>
      <section className='grid w-full gap-8 rounded-[2rem] border border-trim-offset bg-page-base p-6 shadow-card-strong lg:grid-cols-[1.1fr_0.9fr] lg:p-8'>
        <div className='relative min-h-96 overflow-hidden rounded-[1.5rem] border border-trim-offset bg-page-offset'>
          <Image
            src={notFoundImage}
            alt='Digest Engine 404 illustration'
            priority
            fill
            sizes='(min-width: 1024px) 50vw, 100vw'
            className='h-full w-full object-cover'
          />
        </div>

        <div className='flex flex-col justify-center gap-6 text-left'>
          <div className='space-y-4'>
            <p className='text-sm font-semibold uppercase tracking-widest text-primary'>404</p>
            <h1 className='text-4xl font-semibold tracking-tight text-content-active sm:text-5xl'>
              Page not found
            </h1>
            <p className='max-w-2xl text-base leading-7 text-content-offset sm:text-lg'>
              This link is gone or moved, but the main parts of the marketing site are still easy to reach. Jump back into the tour, docs, pricing, or signup flow from here.
            </p>
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            {recoveryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className='rounded-3xl border border-trim-offset bg-page-offset px-5 py-5 text-left no-underline transition-colors hover:border-content-offset hover:bg-background'
              >
                <p className='m-0 text-lg font-semibold tracking-tight text-content-active'>
                  {link.label}
                </p>
                <p className='mt-2 text-sm leading-6 text-content-offset'>{link.description}</p>
              </Link>
            ))}
          </div>

          <div className='flex flex-col gap-3 sm:flex-row'>
            <Link
              href='/'
              className='rounded-full bg-secondary px-5 py-3 text-center text-sm font-medium text-content-active transition-colors hover:bg-accent'
            >
              Back to home
            </Link>
            <Link
              href='/blog'
              className='rounded-full border border-trim-offset px-5 py-3 text-center text-sm font-medium text-content-active transition-colors hover:border-content-offset hover:bg-background'
            >
              Visit the blog
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
