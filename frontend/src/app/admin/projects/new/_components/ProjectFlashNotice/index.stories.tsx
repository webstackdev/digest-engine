import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { ProjectFlashNotice } from "."

const meta = {
  title: "Pages/AdminProjects/New/Components/ProjectFlashNotice",
  component: ProjectFlashNotice,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    tone: "success",
    children: "Project created. You are now the first project admin.",
  },
} satisfies Meta<typeof ProjectFlashNotice>

export default meta

type Story = StoryObj<typeof meta>

export const Success: Story = {}

export const Error: Story = {
  args: {
    tone: "error",
    children: "A project with that name already exists.",
  },
}
