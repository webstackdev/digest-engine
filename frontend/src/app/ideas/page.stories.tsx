import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { AppShell } from "@/components/app-shell"
import { OriginalContentIdeaCard } from "@/components/original-content-idea-card"
import {
  createOriginalContentIdea,
  createProject,
} from "@/lib/storybook-fixtures"

type IdeasPreviewProps = {
  ideas?: ReturnType<typeof createOriginalContentIdea>[]
}

function IdeasPagePreview({ ideas = populatedIdeas }: IdeasPreviewProps) {
  const projects = [createProject()]

  return (
    <AppShell
      title="Original content ideas"
      description="Review project-owned article angles, trigger fresh ideation, and move accepted ideas through the editorial workflow."
      projects={projects}
      selectedProjectId={1}
    >
      <section className="mb-4 flex flex-col gap-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="m-0 text-sm font-medium text-foreground">Status</p>
          <p className="mt-2 text-sm leading-6 text-muted">Preview the queue with representative pending, accepted, written, and dismissed states.</p>
        </div>
        <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105" type="button">
          Generate now
        </button>
      </section>

      <section className="space-y-4">
        {ideas.length === 0 ? (
          <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
            No original-content ideas matched the current filter.
          </div>
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

const meta = {
  title: "Pages/Ideas",
  component: IdeasPagePreview,
  tags: ["autodocs"],
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