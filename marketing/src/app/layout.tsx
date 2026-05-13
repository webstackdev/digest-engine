// @ts-expect-error nextra-theme-docs 4.6.1 does not ship declarations for this internal store module.
import { ThemeConfigProvider, ConfigProvider } from "../../node_modules/nextra-theme-docs/dist/stores/index.js";
// @ts-expect-error nextra-theme-docs 4.6.1 does not export this component publicly.
import { MobileNav } from "../../node_modules/nextra-theme-docs/dist/components/sidebar.js";
// @ts-expect-error nextra-theme-docs 4.6.1 does not export this schema publicly.
import { LayoutPropsSchema } from "../../node_modules/nextra-theme-docs/dist/schemas.js";
import { Metadata } from "next";
import Link from "next/link";
import { Head } from "nextra/components";
import { SkipNavLink } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import type { ReactNode } from "react";
import { Header } from "@/components/Header";
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pageMap = await getPageMap();

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head>
        <script
          defer
          src="https://cdn.torqbit.com/static/js/chat-embed.prod.js"
          data-agentId={process.env.NEXT_PUBLIC_TORQBIT_API_KEY}
          data-position="bottom-right"
        ></script>
      </Head>
      <body className="marketing-site">
        <Header />
        <DocsLayout
          pageMap={pageMap}
          darkMode={false}
          docsRepositoryBase="https://github.com/shuding/nextra/tree/main/docs"
        >
          {children}
        </DocsLayout>
        <footer className="marketing-footer mx-auto mt-6 max-w-marketing px-4 pb-12 pt-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 rounded-panel border border-brand-border-bright bg-brand-surface-overlay px-6 py-6 text-sm text-muted-foreground shadow-brand-soft backdrop-blur-[18px] md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-border-bright bg-brand-surface-muted text-xs font-black tracking-logo text-primary shadow-brand-soft">
                DE
              </span>
              <div>
                <p className="m-0 text-sm font-semibold text-foreground">
                  {brand.name}
                </p>
                <p className="m-0 text-sm">{brand.tagline}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/docs"
                className="no-underline transition-colors hover:text-foreground"
              >
                Docs
              </Link>
              <Link
                href="#features"
                className="no-underline transition-colors hover:text-foreground"
              >
                How It Works
              </Link>
              <Link
                href="#pricing"
                className="no-underline transition-colors hover:text-foreground"
              >
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
