import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { EntityDetailPageContent } from "@/app/entities/[id]/_components/EntityDetailPageContent"
import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createEntity,
  createEntityAuthoritySnapshot,
  createEntityMentionSummary,
  createProject,
  createProjectConfig,
} from "@/lib/storybook-fixtures"

type EntityDetailPagePreviewProps = {
  showError?: boolean
  showMessage?: boolean
}

const meta = {
  title: "Pages/EntityDetail",
  component: EntityDetailPagePreview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {},
} satisfies Meta<typeof EntityDetailPagePreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithFlashes: Story = {
  args: {
    showError: true,
    showMessage: true,
  },
}

function EntityDetailPagePreview({
  showError = false,
  showMessage = false,
}: EntityDetailPagePreviewProps) {
  const selectedProject = createProject({ id: 1, name: "AI Weekly" })
  const entity = createEntity({
    id: 11,
    name: "Anthropic",
    type: "organization",
    authority_score: 0.91,
    description: "Safety-focused AI company",
    website_url: "https://anthropic.com",
    twitter_handle: "anthropicai",
    mention_count: 2,
    project: 1,
  })
  const latestSnapshot = createEntityAuthoritySnapshot({ entity: entity.id, project: 1 })

  return (
    <EntityDetailPageContent
      authorityComponents={latestSnapshot}
      authorityHistory={[
        latestSnapshot,
        createEntityAuthoritySnapshot({
          id: 50,
          computed_at: "2026-04-27T14:00:00Z",
          entity: entity.id,
          final_score: 0.82,
          project: 1,
        }),
      ]}
      entity={entity}
      errorMessage={showError ? "Could not save entity" : undefined}
      mentions={[
        createEntityMentionSummary(),
        createEntityMentionSummary({
          id: 32,
          content_id: 23,
          content_title: "Platform teams discuss Anthropic",
          role: "mentioned",
          sentiment: "neutral",
          confidence: 0.76,
        }),
      ]}
      projectConfig={createProjectConfig()}
      projects={[selectedProject]}
      selectedProject={selectedProject}
      siblingEntities={[
        createEntity({ id: 12, name: "OpenAI", project: 1, mention_count: 1 }),
        createEntity({ id: 13, name: "Mistral", project: 1, mention_count: 3 }),
      ]}
      successMessage={showMessage ? "Entity updated" : undefined}
    />
  )
}