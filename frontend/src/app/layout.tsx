import "../styles/globals.css"

import type { Metadata } from "next"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils";
import { QueryProvider } from "@/providers/QueryProvider"
import { ThemeProvider } from "@/providers/ThemeProvider"

export const metadata: Metadata = {
  title: "Digest Engine Frontend",
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
        suppressHydrationWarning
        className={cn("min-h-screen font-sans antialiased bg-background text-foreground")}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
