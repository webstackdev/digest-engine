import { addons } from "storybook/manager-api"
import { create } from "storybook/theming"

const shadcnTheme = create({
  base: "light",

  fontBase: '"Geist Sans", sans-serif',
  fontCode: '"Geist Mono", monospace',

  brandTitle: "My Component Library",
  brandUrl: "/",
  brandTarget: "_self",

  // Storybook manager theme colors must stay in formats polished can parse.
  colorPrimary: "#06b6d4",
  colorSecondary: "#06b6d4",

  appBg: "#f5f5f5",
  appContentBg: "#fafafa",
  appPreviewBg: "#fafafa",
  appBorderColor: "#e4e4e7",
  appBorderRadius: 10,

  textColor: "#18181b",
  textInverseColor: "#fafafa",

  barTextColor: "#71717a",
  barSelectedColor: "#06b6d4",
  barHoverColor: "#06b6d4",
  barBg: "#fafafa",

  inputBg: "#fafafa",
  inputBorder: "#e4e4e7",
  inputTextColor: "#18181b",
  inputBorderRadius: 8,
})

addons.setConfig({
  theme: shadcnTheme,
})
