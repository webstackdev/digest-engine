export default function NotFound() {
  return (
    <main className='mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center gap-4 px-6 py-16 text-center'>
      <p className='text-sm font-semibold uppercase tracking-[0.24em] text-(--brand-color)'>404</p>
      <h1 className='text-4xl font-semibold tracking-tight text-(--font-primary)'>Page not found</h1>
      <p className='max-w-xl text-base text-(--font-secondary)'>
        The page you requested does not exist or has moved. Use the navigation to return to the docs or homepage.
      </p>
      <a
        href='/'
        className='rounded-full bg-(--bg-secondary) px-5 py-3 text-sm font-medium text-(--font-primary) transition-colors hover:bg-(--bg-selected-menu)'
      >
        Back to home
      </a>
    </main>
  );
}
