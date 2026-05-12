// @ts-expect-error nextra-theme-docs 4.6.1 does not export these provider internals publicly.
import { ThemeConfigProvider, ConfigProvider } from "../../node_modules/nextra-theme-docs/dist/stores/index.js";
// @ts-expect-error nextra-theme-docs 4.6.1 does not export this component publicly.
import { MobileNav } from "../../node_modules/nextra-theme-docs/dist/components/sidebar.js";
// @ts-expect-error nextra-theme-docs 4.6.1 does not export this schema publicly.
import { LayoutPropsSchema } from "../../node_modules/nextra-theme-docs/dist/schemas.js";
import { Head } from "nextra/components";
import { SkipNavLink } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { brand } from "@/lib/props";

import "../styles/globals.css";

export const metadata: Metadata = {
  title: brand.name,
  description: brand.tagline,
};

type DocsLayoutProps = {
  children: ReactNode;
  pageMap: Awaited<ReturnType<typeof getPageMap>>;
  docsRepositoryBase: string;
  darkMode?: boolean;
  footer?: ReactNode;
  navbar?: ReactNode;
};

function DocsLayout({ children, ...themeConfig }: DocsLayoutProps) {
  const parsed = LayoutPropsSchema.safeParse({ children, ...themeConfig });

  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }

  const {
    banner,
    footer,
    navbar,
    pageMap,
    children: layoutChildren,
    ...rest
  } = parsed.data;

  return (
    <ThemeConfigProvider value={rest}>
      <SkipNavLink />
      {banner}
      <ConfigProvider pageMap={pageMap} navbar={navbar} footer={footer}>
        <MobileNav />
        {layoutChildren}
      </ConfigProvider>
    </ThemeConfigProvider>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pageMap = await getPageMap();

  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
    >
      <Head>
        <script
          defer
          src="https://cdn.torqbit.com/static/js/chat-embed.prod.js"
          data-agentId={process.env.NEXT_PUBLIC_TORQBIT_API_KEY}
          data-position="bottom-right"
        ></script>
      </Head>
      <body className="marketing-site">
        <header className='marketing-nav-wrap'>
          <div className='marketing-nav-shell mx-auto max-w-[1180px] px-4 pt-6 sm:px-6 lg:px-8'>
            <div className='marketing-nav flex items-center justify-between gap-4 rounded-[1.65rem] border border-white/70 bg-white/82 px-4 py-3 shadow-[0_20px_44px_rgba(62,77,107,0.12)] backdrop-blur md:px-5'>
              <Link href='/' className='flex items-center gap-3 text-(--font-primary) no-underline'>
                <span className='flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(231,237,234,0.86))] text-sm font-black tracking-[0.22em] text-(--brand-color) shadow-[0_10px_20px_rgba(62,77,107,0.08)]'>
                  DE
                </span>
                <span className='text-lg font-semibold tracking-tight sm:text-xl'>{brand.name}</span>
              </Link>

              <nav className='hidden items-center gap-6 text-sm font-medium text-(--font-secondary) md:flex'>
                <Link href='#features' className='transition-colors hover:text-(--font-primary)'>
                  Features
                </Link>
                <Link href='#pricing' className='transition-colors hover:text-(--font-primary)'>
                  Pricing
                </Link>
                <Link href='#about' className='transition-colors hover:text-(--font-primary)'>
                  About
                </Link>
                <Link href='/docs' className='transition-colors hover:text-(--font-primary)'>
                  Docs
                </Link>
              </nav>

              <div className='flex items-center gap-2'>
                <Link
                  href='/docs'
                  className='rounded-full bg-[linear-gradient(135deg,var(--brand-fill-accent),#d17e60)] px-5 py-3 text-sm font-semibold text-white no-underline shadow-[0_18px_34px_rgba(198,107,82,0.26)] transition hover:brightness-105'
                >
                  Read Docs
                </Link>
              </div>
            </div>
          </div>
        </header>
        <DocsLayout
          pageMap={pageMap}
          darkMode={false}
          docsRepositoryBase="https://github.com/shuding/nextra/tree/main/docs"
        >
          {children}
        </DocsLayout>
        <footer className='marketing-footer mx-auto mt-6 max-w-[1180px] px-4 pb-12 pt-4 sm:px-6 lg:px-8'>
          <div className='flex flex-col gap-5 rounded-[1.75rem] border border-white/70 bg-white/76 px-6 py-6 text-sm text-(--font-secondary) shadow-[0_18px_40px_rgba(62,77,107,0.08)] backdrop-blur md:flex-row md:items-center md:justify-between'>
            <div className='flex items-center gap-3'>
              <span className='flex h-10 w-10 items-center justify-center rounded-2xl border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(231,237,234,0.86))] text-xs font-black tracking-[0.22em] text-(--brand-color) shadow-[0_10px_20px_rgba(62,77,107,0.08)]'>
                DE
              </span>
              <div>
                <p className='m-0 text-sm font-semibold text-(--font-primary)'>{brand.name}</p>
                <p className='m-0 text-sm'>{brand.tagline}</p>
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-4'>
              <Link href='/docs' className='no-underline transition-colors hover:text-(--font-primary)'>
                Docs
              </Link>
              <Link href='#features' className='no-underline transition-colors hover:text-(--font-primary)'>
                Features
              </Link>
              <Link href='#pricing' className='no-underline transition-colors hover:text-(--font-primary)'>
                Pricing
              </Link>
              <span>AGPLv3</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
