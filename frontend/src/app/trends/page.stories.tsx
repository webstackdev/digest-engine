import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import Link from "next/link"

import { TopicClusterCard } from "@/app/trends/_components/TopicClusterCard"
import { StatusBadge } from "@/components/elements/StatusBadge"
import { AppShell } from "@/components/layout/AppShell"
import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createProject,
  createTopicClusterDetail,
} from "@/lib/storybook-fixtures"
import type { TopicClusterDetail, TopicVelocitySnapshot } from "@/lib/types"
import { formatPercentScore } from "@/lib/view-helpers"

const meta = {
  title: "Pages/Trends",
  component: TrendsPagePreview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {},
} satisfies Meta<typeof TrendsPagePreview>

export default meta

type Story = StoryObj<typeof meta>

export const Populated: Story = {}

export const Empty: Story = {
  args: {
    clusters: [],
    selectedCluster: null,
  },
}

const populatedClusters = [
  createTopicClusterDetail(),
  createTopicClusterDetail({
    id: 6,
    label: "Operational Guardrails",
    member_count: 2,
    velocity_score: 0.58,
    z_score: 1.12,
  }),
]

function buildVelocityTrendPoints(snapshots: TopicVelocitySnapshot[]) {
  if (snapshots.length <= 1) {
    return "0,56 220,56"
  }

  const orderedSnapshots = snapshots
    .slice()
    .sort(
      (left, right) =>
        new Date(left.computed_at).getTime() - new Date(right.computed_at).getTime(),
    )

  return orderedSnapshots
    .map((snapshot, index) => {
      const x = (index / (orderedSnapshots.length - 1)) * 220
      const y = 64 - (snapshot.velocity_score ?? 0) * 56
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
}

type TrendsPreviewProps = {
  clusters?: TopicClusterDetail[]
  selectedCluster?: TopicClusterDetail | null
}

function TrendsPagePreview({
  clusters = populatedClusters,
  selectedCluster = populatedClusters[0] ?? null,
}: TrendsPreviewProps) {
  const projects = [createProject()]

  return (
    <AppShell
      title="Trend analysis"
      description="Cluster velocity, member content, and editorial context for the topics accelerating inside this project."
      projects={projects}
      selectedProjectId={1}
    >
      <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Visible clusters</p>
          <p className="mt-1 text-3xl font-bold">{clusters.length}</p>
        </article>
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Avg velocity</p>
          <p className="mt-1 text-3xl font-bold">
            {formatPercentScore(
              clusters.length > 0
                ? clusters.reduce((total, cluster) => total + (cluster.velocity_score ?? 0), 0) / clusters.length
                : null,
            )}
          </p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(300px,0.95fr)_minmax(0,1.65fr)]">
        <div className="space-y-4">
          {clusters.length === 0 ? (
            <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
              No topic clusters matched the current filters.
            </div>
          ) : null}
          {clusters.map((cluster) => (
            <TopicClusterCard
              cluster={cluster}
              href={`/trends?project=1&cluster=${cluster.id}`}
              isSelected={selectedCluster?.id === cluster.id}
              key={cluster.id}
            />
          ))}
        </div>

        <div className="space-y-4">
          {selectedCluster ? (
            <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Cluster detail</p>
                  <h2 className="font-display text-title-md font-bold text-foreground">{selectedCluster.label}</h2>
                </div>
                <StatusBadge tone={(selectedCluster.velocity_score ?? 0) >= 0.7 ? "positive" : "warning"}>
                  Velocity {formatPercentScore(selectedCluster.velocity_score)}
                </StatusBadge>
              </div>
              <div className="mt-4 rounded-panel bg-muted/60 px-4 py-4">
                <svg
                  aria-label="Velocity history trend"
                  className="mt-3 h-20 w-full overflow-visible text-foreground"
                  role="img"
                  viewBox="0 0 220 72"
                >
                  <polyline
                    fill="none"
                    points={buildVelocityTrendPoints(selectedCluster.velocity_history)}
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                  />
                </svg>
              </div>
              <div className="mt-4 grid gap-3">
                {selectedCluster.memberships.map((membership) => (
                  <div className="rounded-panel bg-muted/60 px-4 py-4" key={membership.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Link className="font-medium text-foreground underline-offset-4 hover:underline" href={`/content/${membership.content.id}?project=1`}>
                        {membership.content.title}
                      </Link>
                      <span className="text-sm text-muted">Similarity {Math.round(membership.similarity * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : (
            <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
              Select a cluster to preview the drill-down state.
            </div>
          )}
        </div>
      </section>
    </AppShell>
  )
}
