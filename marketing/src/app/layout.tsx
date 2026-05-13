import { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/props";

import "../styles/globals.css";

export const metadata: Metadata = {
  title: brand.name,
  description: brand.tagline,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className="marketing-site">
        {children}
        <footer className="mx-auto mt-6 max-w-6xl px-4 pb-12 pt-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 rounded-3xl border border-trim-offset bg-page-base px-6 py-6 text-sm text-content-offset shadow-soft backdrop-blur-[18px] md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-trim-offset bg-secondary text-xs font-black tracking-widest text-primary shadow-soft">
                DE
              </span>
              <div>
                <p className="m-0 text-sm font-semibold text-content-active">
                  {brand.name}
                </p>
                <p className="m-0 text-sm">{brand.tagline}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/docs"
                className="no-underline transition-colors hover:text-content-active"
              >
                Docs
              </Link>
              <Link
                href="#features"
                className="no-underline transition-colors hover:text-content-active"
              >
                How It Works
              </Link>
              <Link
                href="#pricing"
                className="no-underline transition-colors hover:text-content-active"
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
