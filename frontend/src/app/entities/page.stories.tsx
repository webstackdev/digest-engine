import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { EntitiesPageContent } from "@/app/entities/_components/EntitiesPageContent"
import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createEntity,
  createEntityCandidate,
  createProject,
} from "@/lib/storybook-fixtures"

type EntitiesPagePreviewProps = {
  entities?: ReturnType<typeof createEntity>[]
  entityCandidates?: ReturnType<typeof createEntityCandidate>[]
  errorMessage?: string
  successMessage?: string
}

const meta = {
  title: "Pages/Entities",
  component: EntitiesPagePreview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {},
} satisfies Meta<typeof EntitiesPagePreview>

export default meta

type Story = StoryObj<typeof meta>

export const Populated: Story = {}

export const Empty: Story = {
  args: {
    entities: [],
    entityCandidates: [],
  },
}

export const WithFlashMessages: Story = {
  args: {
    errorMessage: "Could not save entity",
    successMessage: "Entity saved",
  },
}

const populatedEntities = [
  createEntity(),
  createEntity({
    id: 11,
    authority_score: 0.91,
    mention_count: 2,
    name: "Anthropic",
    project: 1,
    type: "organization",
  }),
]

const populatedEntityCandidates = [
  createEntityCandidate(),
  createEntityCandidate({
    id: 15,
    name: "Operator Loop",
    occurrence_count: 4,
    suggested_type: "organization",
  }),
]

function EntitiesPagePreview({
  entities = populatedEntities,
  entityCandidates = populatedEntityCandidates,
  errorMessage,
  successMessage,
}: EntitiesPagePreviewProps) {
  return (
    <EntitiesPageContent
      entities={entities}
      entityCandidates={entityCandidates}
      errorMessage={errorMessage}
      projects={[createProject()]}
      selectedProjectId={1}
      successMessage={successMessage}
    />
  )
}
