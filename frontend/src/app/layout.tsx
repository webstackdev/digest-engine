import "./globals.css"

import type { Metadata } from "next"
import { Fraunces, Space_Grotesk } from "next/font/google"
import type { ReactNode } from "react"

import { QueryProvider } from "@/components/query-provider"

const display = Fraunces({
  variable: "--font-display-source",
  subsets: ["latin"],
})

const body = Space_Grotesk({
  variable: "--font-body-source",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Newsletter Maker Frontend",
  description: "Minimal dashboard for reviewing ingested newsletter content.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} min-h-screen font-body text-ink antialiased`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
