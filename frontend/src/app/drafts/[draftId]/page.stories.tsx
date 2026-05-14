import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { DraftEditor } from "@/app/drafts/[draftId]/_components/DraftEditor"
import { DraftOverviewCards } from "@/app/drafts/[draftId]/_components/DraftOverviewCards"
import { DraftRenderedOutput } from "@/app/drafts/[draftId]/_components/DraftRenderedOutput"
import { DraftViewSwitcher } from "@/app/drafts/[draftId]/_components/DraftViewSwitcher"
import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { compactDocsParameters } from "@/lib/storybook-docs"
import { createProject } from "@/lib/storybook-fixtures"
import type { NewsletterDraft } from "@/lib/types"

type DraftDetailPagePreviewProps = {
  showError?: boolean
  showMessage?: boolean
  view?: "editor" | "markdown" | "html"
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
      coherence_suggestions: ["Tighten the intro transition."],
    },
    sections: [
      {
        id: 21,
        draft: 8,
        theme_suggestion: 3,
        theme_suggestion_detail: {
          id: 3,
          title: "Delivery signals",
          pitch: "Pitch",
          why_it_matters: "Why it matters",
        },
        title: "Delivery signals",
        lede: "Section lede.",
        order: 0,
        items: [
          {
            id: 44,
            section: 21,
            content: 55,
            content_detail: {
              id: 55,
              url: "https://example.com/post",
              title: "Useful article",
              source_plugin: "rss",
              published_date: "2026-05-02T10:00:00Z",
            },
            summary_used: "Item summary.",
            why_it_matters: "Item why.",
            order: 0,
          },
        ],
      },
    ],
    original_pieces: [
      {
        id: 31,
        draft: 8,
        idea: 9,
        idea_detail: {
          id: 9,
          angle_title: "Original idea",
          summary: "Summary",
          suggested_outline: "1. Outline",
        },
        title: "Original idea",
        pitch: "Pitch",
        suggested_outline: "1. Outline",
        order: 0,
      },
    ],
    rendered_markdown: "# Draft",
    rendered_html: "<h1>Draft</h1>",
    ...overrides,
  }
}

const meta = {
  title: "Pages/DraftDetail",
  component: DraftDetailPagePreview,
  tags: ["autodocs"],
  parameters: { docs: compactDocsParameters },
  args: {
    view: "editor",
  },
} satisfies Meta<typeof DraftDetailPagePreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Markdown: Story = {
  args: { view: "markdown" },
}

export const Html: Story = {
  args: { view: "html" },
}

function DraftDetailPagePreview({
  showError = false,
  showMessage = false,
  view = "editor",
}: DraftDetailPagePreviewProps) {
  const selectedProject = createProject({ id: 1 })
  const draft = createDraft()
  const currentPageHref = `/drafts/${draft.id}?project=${selectedProject.id}`

  return (
    <AppShell
      title="Draft detail"
      description="Review the current draft tree, export its rendered output, and trigger targeted section regeneration."
      projects={[selectedProject]}
      selectedProjectId={selectedProject.id}
    >
      {showError ? (
        <Alert className="rounded-3xl border-danger bg-danger" variant="destructive">
          <AlertDescription className="text-danger">Unable to save draft section.</AlertDescription>
        </Alert>
      ) : null}
      {showMessage ? (
        <Alert className="rounded-3xl border-trim-offset bg-page-offset">
          <AlertDescription>Draft updated.</AlertDescription>
        </Alert>
      ) : null}

      <DraftOverviewCards draft={draft} />
      <DraftViewSwitcher currentView={view} draftId={draft.id} selectedProjectId={selectedProject.id} />
      <DraftRenderedOutput draft={draft} view={view} />
      {view === "editor" ? (
        <DraftEditor currentPageHref={currentPageHref} draft={draft} projectId={selectedProject.id} />
      ) : null}
    </AppShell>
  )
}
