import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import LoginPageContent from "."

const meta = {
  title: "Pages/Login/Components/LoginPageContent",
  component: LoginPageContent,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    callbackUrl: "/entities?project=2",
  },
} satisfies Meta<typeof LoginPageContent>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
