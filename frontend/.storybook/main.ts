import type { StorybookConfig } from "@storybook/nextjs-vite"

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx|js|jsx|mjs)"],
  /** Order determines toolbar prominence */
  addons: [
    "@storybook/addon-onboarding", // Optional: keep at the start if still learning
    "@storybook/addon-links",
    "@storybook/addon-essentials",  // Contains Backgrounds, Controls, and Actions
    "@storybook/addon-themes",      // Position 1 in toolbar: Theme switcher
    "@storybook/addon-viewport",    // Position 2 in toolbar: Device sizes
    "@storybook/addon-a11y",        // Position 1 in panel: Accessibility tab
    "@storybook/addon-vitest",      // Position 2 in panel: Test results
    "@chromatic-com/storybook",     // Usually adds a dedicated "Visual Tests" tab
    "@storybook/addon-docs",        // Documentation tab (often grouped separately)
  ],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  staticDirs: ["../public"],
}

export default config
