import type { ReactNode } from "react";
import { Metadata } from "next";
import Script from "next/script";
import { AttributionCapture } from "@/components/AttributionCapture";
import { Clarity } from "@/components/Clarity";
import { Consent } from "@/components/Consent";
import { Footer } from "@/components/Footer";
import { GoogleTagManagerWithConsent } from "@/components/GoogleTagManagerWithConsent";
import { Header } from "@/components/Header";
import { brand } from "@/lib/props";
import { themeInitScript } from "@/lib/themeInit";

import "../styles/globals.css";

export const metadata: Metadata = {
  title: brand.name,
  description: brand.tagline,
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <html
      lang="en"
      dir="ltr"
      data-theme="light"
      className="page-background"
      suppressHydrationWarning
    >
      <body className="px-4" suppressHydrationWarning>
        <Script id="marketing-theme-init" strategy="beforeInteractive">
          {`(${themeInitScript.toString()})();`}
        </Script>
        <AttributionCapture />
        {gtmId && <GoogleTagManagerWithConsent gtmId={gtmId} />}
        {clarityId && <Clarity clarityId={clarityId} />}
        <Header />
        {children}
        <Consent />
        <Footer />
      </body>
    </html>
  );
}
