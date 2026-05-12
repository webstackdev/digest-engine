import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "../app/globals.css";
import Image from "next/image";
import { Metadata } from "next";
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
        <Layout
          pageMap={pageMap}
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
        </Layout>
      </body>
    </html>
  );
}
