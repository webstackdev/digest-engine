import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createEntity,
  createEntityAuthoritySnapshot,
  createProjectConfig,
} from "@/lib/storybook-fixtures"

import { AuthorityHistoryPanel } from "."

const latestSnapshot = createEntityAuthoritySnapshot({ entity: 11, project: 1 })

const meta = {
  title: "Pages/EntityDetail/Components/AuthorityHistoryPanel",
  component: AuthorityHistoryPanel,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    authorityComponents: latestSnapshot,
    authorityHistory: [
      latestSnapshot,
      createEntityAuthoritySnapshot({
        id: 50,
        computed_at: "2026-04-27T14:00:00Z",
        entity: 11,
        final_score: 0.82,
        project: 1,
      }),
    ],
    entity: createEntity({ id: 11, authority_score: 0.91, project: 1 }),
    projectConfig: createProjectConfig(),
    projectId: 1,
    redirectTo: "/entities/11?project=1",
    userRole: "admin",
  },
} satisfies Meta<typeof AuthorityHistoryPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    authorityComponents: null,
    authorityHistory: [],
    projectConfig: null,
    userRole: "member",
  },
}
