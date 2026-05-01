import "../src/app/globals.css"

import type { Preview } from "@storybook/nextjs-vite"
import type { ReactNode } from "react"

import { QueryProvider } from "../src/providers/QueryProvider"

function StorybookProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <div className="min-h-screen bg-background p-6 text-foreground">{children}</div>
    </QueryProvider>
  )
}

const preview: Preview = {
  tags: ['autodocs'],
  parameters: {
    options: {
      storySort: {
        order: [
          'Pages',
          ['*', ['Components', 'Views', '*']],  // Pages > [PageName] > Components/Views
          'Layout',
          'Features',
          ['*', ['Components', '*']],           // Features > [FeatureName] > Components
          'UI',
          ['*'],                                // UI > [ComponentName]
          '*',                                  // <--- Catch-all
        ],
      },
    },
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
