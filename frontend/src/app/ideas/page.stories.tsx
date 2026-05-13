import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { IdeasQueueOverview } from "@/app/ideas/_components/IdeasQueueOverview"
import { IdeasToolbarCard } from "@/app/ideas/_components/IdeasToolbarCard"
import { OriginalContentIdeaCard } from "@/app/ideas/_components/OriginalContentIdeaCard"
import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createOriginalContentIdea,
  createProject,
} from "@/lib/storybook-fixtures"

type IdeasPreviewProps = {
  ideas?: ReturnType<typeof createOriginalContentIdea>[]
}

const meta = {
  title: "Pages/Ideas",
  component: IdeasPagePreview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {},
} satisfies Meta<typeof IdeasPagePreview>

export default meta

type Story = StoryObj<typeof meta>

export const Populated: Story = {}

export const Empty: Story = {
  args: {
    ideas: [],
  },
}

const populatedIdeas = [
  createOriginalContentIdea(),
  createOriginalContentIdea({
    id: 10,
    status: "accepted",
    decided_at: "2026-04-29T09:00:00Z",
    decided_by: 5,
    decided_by_username: "editor-2",
  }),
  createOriginalContentIdea({
    id: 11,
    status: "written",
    decided_at: "2026-04-30T10:00:00Z",
    decided_by: 5,
    decided_by_username: "editor-2",
  }),
]


function IdeasPagePreview({ ideas = populatedIdeas }: IdeasPreviewProps) {
  const projects = [createProject()]
  const pendingCount = ideas.filter((idea) => idea.status === "pending").length
  const acceptedCount = ideas.filter((idea) => idea.status === "accepted").length
  const writtenCount = ideas.filter((idea) => idea.status === "written").length
  const dismissedCount = ideas.filter((idea) => idea.status === "dismissed").length

  return (
    <AppShell
      title="Original content ideas"
      description="Review project-owned article angles, trigger fresh ideation, and move accepted ideas through the editorial workflow."
      projects={projects}
      selectedProjectId={1}
    >
      <IdeasQueueOverview
        acceptedCount={acceptedCount}
        dismissedCount={dismissedCount}
        pendingCount={pendingCount}
        writtenCount={writtenCount}
      />

      <IdeasToolbarCard
        currentPageHref="/ideas?project=1"
        projectId={1}
        statusFilter="all"
      />

      <section className="space-y-4">
        {ideas.length === 0 ? (
          <Alert className="rounded-3xl border-trim-offset bg-muted">
            <AlertDescription>No original-content ideas matched the current filter.</AlertDescription>
          </Alert>
        ) : null}
        {ideas.map((idea) => (
          <OriginalContentIdeaCard
            currentPageHref="/ideas?project=1"
            idea={idea}
            key={idea.id}
            projectId={1}
          />
        ))}
      </section>
    </AppShell>
  )
}
