import type { StorybookConfig } from "@storybook/nextjs-vite"

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx|js|jsx|mjs)"],
  addons: [
    "@storybook/addon-themes",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
    "@chromatic-com/storybook",
    "@storybook/addon-docs",
  ],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  staticDirs: ["../public"],
}

export default config
