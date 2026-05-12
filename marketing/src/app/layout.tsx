import { Footer, Navbar } from "nextra-theme-docs";
// @ts-expect-error nextra-theme-docs 4.6.1 does not export these provider internals publicly.
import { ThemeConfigProvider, ConfigProvider } from "../../node_modules/nextra-theme-docs/dist/stores/index.js";
// @ts-expect-error nextra-theme-docs 4.6.1 does not export this component publicly.
import { MobileNav } from "../../node_modules/nextra-theme-docs/dist/components/sidebar.js";
// @ts-expect-error nextra-theme-docs 4.6.1 does not export this schema publicly.
import { LayoutPropsSchema } from "../../node_modules/nextra-theme-docs/dist/schemas.js";
import { Head } from "nextra/components";
import { SkipNavLink } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "../app/globals.css";
import Image from "next/image";
import { Metadata } from "next";
import type { ReactNode } from "react";
import { brand } from "@/lib/props";

export const metadata: Metadata = {
  title: brand.name,
  description: brand.tagline,
};

const footer = (
  <Footer className='flex item-center gap-2.5'>
    <div className='flex item-center gap-2'>
      <Image src={brand.logo} alt='logo' className='h-auto w-10' height={40} width={40} />
      <h4 style={{ margin: 0, padding: 0, lineHeight: 1.9 }}>{brand.name}</h4>
    </div>
  </Footer>
);

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
      lang='en'
      dir='ltr'
      suppressHydrationWarning
    >
      <Head>
        <script
          defer
          src='https://cdn.torqbit.com/static/js/chat-embed.prod.js'
          data-agentId={process.env.NEXT_PUBLIC_TORQBIT_API_KEY}
          data-position='bottom-right'
        ></script>
      </Head>
      <body>
        <DocsLayout
          pageMap={pageMap}
          darkMode={false}
          docsRepositoryBase='https://github.com/shuding/nextra/tree/main/docs'
          footer={footer}
          navbar={
            <Navbar
              logoLink='/'
              className='w-full justify-between px-5 x:mx-auto '
              logo={
                <div className='flex item-center gap-2'>
                  <Image src={brand.logo} alt='logo' className='h-auto w-10' height={40} width={40} />
                  <h4 style={{ fontSize: "1.4rem", fontWeight: "600" }}>{brand.name}</h4>
                </div>
              }
            />
          }
        >
          {children}
        </DocsLayout>
      </body>
    </html>
  );
}
