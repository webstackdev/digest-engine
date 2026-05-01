import "./globals.css"

import type { Metadata } from "next"
import { Fraunces, Space_Grotesk } from "next/font/google"
import type { ReactNode } from "react"

import { QueryProvider } from "@/components/query-provider"
import { ThemeProvider } from "@/components/theme-provider"

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
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${display.variable} ${body.variable} min-h-screen bg-paper font-body text-ink antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
