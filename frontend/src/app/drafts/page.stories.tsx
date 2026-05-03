import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { DraftsList } from "@/app/drafts/_components/DraftsList"
import { DraftsOverviewCards } from "@/app/drafts/_components/DraftsOverviewCards"
import { DraftsToolbar } from "@/app/drafts/_components/DraftsToolbar"
import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { compactDocsParameters } from "@/lib/storybook-docs"
import { createProject } from "@/lib/storybook-fixtures"
import type { NewsletterDraft } from "@/lib/types"

type DraftsPagePreviewProps = {
  showError?: boolean
  showMessage?: boolean
  statusFilter?: string
  empty?: boolean
}

function createDraft(overrides: Partial<NewsletterDraft> = {}): NewsletterDraft {
  return {
    id: 8,
    project: 1,
    title: "AI Weekly: Delivery signals and more",
    intro: "A quick editor-ready summary.",
    outro: "Closing thought.",
    target_publish_date: "2026-05-08",
    status: "ready",
    generated_at: "2026-05-03T09:00:00Z",
    last_edited_at: null,
    generation_metadata: {
      source_theme_ids: [1, 2],
      source_idea_ids: [4],
      trigger_source: "manual",
      models: { section_composer: "heuristic" },
    },
    sections: [],
    original_pieces: [],
    rendered_markdown: "# Draft",
    rendered_html: "<h1>Draft</h1>",
    ...overrides,
  }
}

const meta = {
  title: "Pages/Drafts",
  component: DraftsPagePreview,
  tags: ["autodocs"],
  parameters: { docs: compactDocsParameters },
  args: {
    statusFilter: "all",
  },
} satisfies Meta<typeof DraftsPagePreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ReadyFiltered: Story = {
  args: {
    statusFilter: "ready",
  },
}

export const Empty: Story = {
  args: {
    empty: true,
  },
}

export const WithError: Story = {
  args: {
    showError: true,
  },
}

function DraftsPagePreview({
  showError = false,
  showMessage = false,
  statusFilter = "all",
  empty = false,
}: DraftsPagePreviewProps) {
  const selectedProject = createProject({ id: 1 })
  const allDrafts = [
    createDraft({ id: 7, status: "generating", title: "AI Weekly: Signals in flight" }),
    createDraft({ id: 8, status: "ready" }),
    createDraft({ id: 9, status: "edited", title: "AI Weekly: Tools under review" }),
    createDraft({ id: 10, status: "published", title: "AI Weekly: Published edition" }),
    createDraft({ id: 11, status: "discarded", title: "AI Weekly: Failed generation" }),
  ]
  const filteredDrafts = empty
    ? []
    : statusFilter === "all"
      ? allDrafts
      : allDrafts.filter((draft) => draft.status === statusFilter)
  const currentPageHref =
    statusFilter === "all"
      ? `/drafts?project=${selectedProject.id}`
      : `/drafts?project=${selectedProject.id}&status=${statusFilter}`

  return (
    <AppShell
      title="Newsletter drafts"
      description="Generate project-ready editions, inspect their composition status, and open a draft for editorial review."
      projects={[selectedProject]}
      selectedProjectId={selectedProject.id}
    >
      {showError ? (
        <Alert className="rounded-panel border-destructive/20 bg-destructive/14" variant="destructive">
          <AlertDescription className="text-destructive">
            Unable to generate a new draft.
          </AlertDescription>
        </Alert>
      ) : null}
      {showMessage ? (
        <Alert className="rounded-panel border-border/12 bg-muted/60">
          <AlertDescription>Draft queued successfully.</AlertDescription>
        </Alert>
      ) : null}

      <DraftsOverviewCards drafts={allDrafts} />
      <DraftsToolbar
        currentPageHref={currentPageHref}
        selectedProjectId={selectedProject.id}
        statusFilter={statusFilter}
      />
      <DraftsList drafts={filteredDrafts} selectedProjectId={selectedProject.id} />
    </AppShell>
  )
}
