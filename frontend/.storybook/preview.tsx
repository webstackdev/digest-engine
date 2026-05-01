import "../src/app/globals.css"

import type { Preview } from "@storybook/nextjs-vite"
import type { ReactNode } from "react"

import { QueryProvider } from "../src/components/query-provider"
import { ThemeProvider } from "../src/components/theme-provider"

function StorybookProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryProvider>
        <div className="min-h-screen bg-paper p-6 text-ink">{children}</div>
      </QueryProvider>
    </ThemeProvider>
  )
}

const preview: Preview = {
  parameters: {
    layout: "padded",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    (Story) => (
      <StorybookProviders>
        <Story />
      </StorybookProviders>
    ),
  ],
}

export default preview