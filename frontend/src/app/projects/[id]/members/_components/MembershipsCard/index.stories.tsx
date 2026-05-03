import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createProjectMembership } from "@/lib/storybook-fixtures"

import { MembershipsCard } from "."

const meta = {
  title: "Pages/ProjectMembers/Components/MembershipsCard",
  component: MembershipsCard,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projectId: 1,
    redirectTarget: "/projects/1/members?project=1",
    memberships: [
      createProjectMembership(),
      createProjectMembership({
        id: 7,
        username: "grace",
        email: "grace@example.com",
        display_name: "Grace Hopper",
        role: "member",
      }),
    ],
  },
} satisfies Meta<typeof MembershipsCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}