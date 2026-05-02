import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { ThemeSuggestionCard } from "@/app/themes/_components/ThemeSuggestionCard"
import { AppShell } from "@/components/layout/AppShell"
import {
  createProject,
  createThemeSuggestion,
  createTopicCluster,
  createTopicClusterDetail,
} from "@/lib/storybook-fixtures"
import { compactDocsParameters } from "@/lib/storybook-docs"

type ThemesPreviewProps = {
  themes?: ReturnType<typeof createThemeSuggestion>[]
}

const meta = {
  title: "Pages/Themes",
  component: ThemesPagePreview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {},
} satisfies Meta<typeof ThemesPagePreview>

export default meta

type Story = StoryObj<typeof meta>

export const Populated: Story = {}

export const Empty: Story = {
  args: {
    themes: [],
  },
}

function ThemesPagePreview({ themes = populatedThemes }: ThemesPreviewProps) {
  const projects = [createProject()]
  const cluster = createTopicCluster()
  const clusterDetail = createTopicClusterDetail()

  return (
    <AppShell
      title="Theme queue"
      description="Review velocity-derived theme suggestions, accept the ones worth promoting, and record structured feedback on the rest."
      projects={projects}
      selectedProjectId={1}
    >
      <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Pending</p>
          <p className="mt-1 text-3xl font-bold">{themes.filter((theme) => theme.status === "pending").length}</p>
        </article>
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Dismissed</p>
          <p className="mt-1 text-3xl font-bold">{themes.filter((theme) => theme.status === "dismissed").length}</p>
        </article>
      </section>

      <section className="space-y-4">
        {themes.length === 0 ? (
          <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
            No theme suggestions matched the current filter.
          </div>
        ) : null}
        {themes.map((theme) => (
          <ThemeSuggestionCard
            cluster={cluster}
            clusterDetail={clusterDetail}
            currentPageHref="/themes?project=1"
            key={theme.id}
            projectId={1}
            theme={theme}
          />
        ))}
      </section>
    </AppShell>
  )
}

const populatedThemes = [
  createThemeSuggestion(),
  createThemeSuggestion({
    id: 8,
    status: "accepted",
    decided_at: "2026-04-29T08:00:00Z",
    decided_by: 4,
    decided_by_username: "editor-1",
    promoted_contents: [
      {
        id: 77,
        url: "https://example.com/promoted",
        title: "Accepted supporting article",
        published_date: "2026-04-28T05:00:00Z",
        source_plugin: "rss",
        newsletter_promotion_at: "2026-04-29T08:00:00Z",
      },
    ],
  }),
  createThemeSuggestion({
    id: 9,
    status: "dismissed",
    dismissal_reason: "already covered",
  }),
]
