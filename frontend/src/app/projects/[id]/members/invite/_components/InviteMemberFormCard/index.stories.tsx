import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { InviteMemberFormCard } from "."

const meta = {
  title: "Pages/ProjectMemberInvite/Components/InviteMemberFormCard",
  component: InviteMemberFormCard,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projectId: 1,
    redirectTarget: "/projects/1/members/invite?project=1",
    backHref: "/projects/1/members?project=1",
  },
} satisfies Meta<typeof InviteMemberFormCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}