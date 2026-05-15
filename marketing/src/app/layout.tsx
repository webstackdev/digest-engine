import type { ReactNode } from "react";
import { Metadata } from "next";
import Script from "next/script";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { brand } from "@/lib/props";

import "../styles/globals.css";

const themeInitScript = `
  (() => {
    try {
      const storedTheme = window.localStorage.getItem("marketing-theme");

      if (storedTheme === "light" || storedTheme === "dark") {
        document.documentElement.dataset.theme = storedTheme;
        document.documentElement.style.colorScheme = storedTheme;
      }
    } catch {}
  })();
`;

export const metadata: Metadata = {
  title: brand.name,
  description: brand.tagline,
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" data-theme="light" suppressHydrationWarning>
      <body className="bg-page-base page-background px-4" suppressHydrationWarning>
        <Script id="marketing-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
