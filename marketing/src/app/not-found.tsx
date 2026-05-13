import Link from "next/link";

export default function NotFound() {
  return (
    <main className='mx-auto flex min-h-96 max-w-3xl flex-col items-center justify-center gap-4 px-6 py-16 text-center'>
      <p className='text-sm font-semibold uppercase tracking-widest text-primary'>404</p>
      <h1 className='text-4xl font-semibold tracking-tight text-content-active'>Page not found</h1>
      <p className='max-w-xl text-base text-content-offset'>
        The page you requested does not exist or has moved. Use the navigation to return to the docs or homepage.
      </p>
      <Link
        href='/'
        className='rounded-full bg-secondary px-5 py-3 text-sm font-medium text-content-active transition-colors hover:bg-accent'
      >
        Back to home
      </Link>
    </main>
  );
}
