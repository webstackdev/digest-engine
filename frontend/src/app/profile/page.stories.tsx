import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { ProfileSettingsWorkspace } from "@/app/profile/_components/ProfileSettingsWorkspace"
import { AppShell } from "@/components/layout/AppShell"
import { compactDocsParameters } from "@/lib/storybook-docs"
import { createProject, createUserProfile } from "@/lib/storybook-fixtures"

type ProfilePagePreviewProps = {
  noticeMessage?: string
  noticeTone?: "error" | "success"
}

const meta = {
  title: "Pages/Profile",
  component: ProfilePagePreview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {},
} satisfies Meta<typeof ProfilePagePreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithSuccessNotice: Story = {
  args: {
    noticeMessage: "Profile saved.",
    noticeTone: "success",
  },
}

function ProfilePagePreview({
  noticeMessage,
  noticeTone = "success",
}: ProfilePagePreviewProps) {
  const projects = [createProject()]

  return (
    <AppShell
      title="Profile"
      description="Update your editor identity, upload an avatar, and keep the shared header profile surface in sync."
      projects={projects}
      selectedProjectId={1}
    >
      <ProfileSettingsWorkspace
        isRemoving={false}
        isSaving={false}
        isUploading={false}
        notice={noticeMessage ? { message: noticeMessage, tone: noticeTone } : null}
        onRemove={() => {}}
        onSave={async () => {}}
        onUpload={async () => {}}
        profile={createUserProfile()}
      />
    </AppShell>
  )
}