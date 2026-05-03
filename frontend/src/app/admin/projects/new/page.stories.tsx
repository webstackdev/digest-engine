import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { NewProjectFormCard } from "@/app/admin/projects/new/_components/NewProjectFormCard"
import { ProjectFlashNotice } from "@/app/admin/projects/new/_components/ProjectFlashNotice"
import { AppShell } from "@/components/layout/AppShell"
import { compactDocsParameters } from "@/lib/storybook-docs"
import { createProject } from "@/lib/storybook-fixtures"

type NewProjectPagePreviewProps = {
  showError?: boolean
  showSuccess?: boolean
}

const meta = {
  title: "Pages/AdminProjects/New",
  component: NewProjectPagePreview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {},
} satisfies Meta<typeof NewProjectPagePreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithSuccess: Story = {
  args: {
    showSuccess: true,
  },
}

export const WithError: Story = {
  args: {
    showError: true,
  },
}

function NewProjectPagePreview({
  showError = false,
  showSuccess = false,
}: NewProjectPagePreviewProps) {
  const projects = [createProject()]

  return (
    <AppShell
      title="Create project"
      description="Spin up a new editorial workspace and become its first project admin automatically."
      projects={projects}
      selectedProjectId={1}
    >
      {showError ? (
        <ProjectFlashNotice tone="error">
          A project with that name already exists.
        </ProjectFlashNotice>
      ) : null}
      {showSuccess ? (
        <ProjectFlashNotice tone="success">
          Project created. You are now the first project admin.
        </ProjectFlashNotice>
      ) : null}
      <NewProjectFormCard />
    </AppShell>
  )
}
