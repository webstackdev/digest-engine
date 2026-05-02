import "../src/app/globals.css"

import { withThemeByClassName } from "@storybook/addon-themes"
import type { Preview } from "@storybook/nextjs-vite"
import type { ReactNode } from "react"

import { QueryProvider } from "../src/providers/QueryProvider"

export const decorators = [
  withThemeByClassName({
    themes: {
      light: "",
      dark: "dark",
    },
    defaultTheme: "light",
  }),
]

function StorybookProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <div className="min-h-screen bg-background p-6 text-foreground">{children}</div>
    </QueryProvider>
  )
}

const preview: Preview = {
  tags: ["autodocs"],
  parameters: {
    options: {
      storySort: {
        order: [
          "Pages",
          ["*", ["Components", "Views", "*"]],
          "Layout",
          "Features",
          ["*", ["Components", "*"]],
          "UI",
          ["*"],
          "*",
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
