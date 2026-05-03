import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { SourceDiversityPanel } from "@/app/admin/health/_components/SourceDiversityPanel"
import { SourceHealthPanel } from "@/app/admin/health/_components/SourceHealthPanel"
import { TopicCentroidPanel } from "@/app/admin/health/_components/TopicCentroidPanel"
import { TrendTaskRunsPanel } from "@/app/admin/health/_components/TrendTaskRunsPanel"
import { AppShell } from "@/components/layout/AppShell"
import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createIngestionRun,
  createProject,
  createSourceConfig,
  createSourceDiversitySnapshot,
  createSourceDiversitySummary,
  createTopicCentroidSnapshot,
  createTopicCentroidSummary,
} from "@/lib/storybook-fixtures"

type HealthPreviewProps = {
  alerting?: boolean
  noSnapshots?: boolean
}

const meta = {
  title: "Pages/AdminHealth",
  component: HealthPagePreview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {},
} satisfies Meta<typeof HealthPagePreview>

export default meta

type Story = StoryObj<typeof meta>

export const Healthy: Story = {}

export const Alerting: Story = {
  args: {
    alerting: true,
  },
}

export const NoSnapshots: Story = {
  args: {
    noSnapshots: true,
  },
}

function HealthPagePreview({ alerting = false, noSnapshots = false }: HealthPreviewProps) {
  const projects = [createProject()]
  const centroidSnapshots = noSnapshots
    ? []
    : [
        createTopicCentroidSnapshot({ id: 1, computed_at: "2026-04-25T08:00:00Z", drift_from_previous: 0.08 }),
        createTopicCentroidSnapshot({ id: 2, computed_at: "2026-04-26T08:00:00Z", drift_from_previous: 0.12 }),
        createTopicCentroidSnapshot({ id: 3, computed_at: "2026-04-27T08:00:00Z", drift_from_previous: 0.18 }),
      ]
  const centroidSummary = createTopicCentroidSummary({
    latest_snapshot: noSnapshots ? null : centroidSnapshots[2],
    snapshot_count: noSnapshots ? 0 : 4,
    active_snapshot_count: noSnapshots ? 0 : 4,
    avg_drift_from_previous: noSnapshots ? null : 0.12,
    avg_drift_from_week_ago: noSnapshots ? null : 0.19,
  })
  const sourceDiversitySummary = noSnapshots
    ? createSourceDiversitySummary({ snapshot_count: 0, latest_snapshot: null })
    : createSourceDiversitySummary({
        latest_snapshot: createSourceDiversitySnapshot({
          breakdown: {
            ...createSourceDiversitySnapshot().breakdown,
            alerts: alerting
              ? [
                  {
                    code: "top_plugin_share",
                    severity: "warning",
                    message: "Your stream is 70%+ from RSS this week.",
                  },
                ]
              : [],
          },
          top_plugin_share: alerting ? 0.78 : 0.62,
        }),
      })
  const sourceConfigs = [
    createSourceConfig(),
    createSourceConfig({ id: 8, plugin_name: "reddit", is_active: !alerting, last_fetched_at: alerting ? null : "2026-04-28T07:00:00Z" }),
  ]
  const runs = [
    createIngestionRun(),
    createIngestionRun({ id: 23, plugin_name: "reddit", status: alerting ? "failed" : "success", error_message: alerting ? "Rate limit" : "" }),
  ]
  const trendRuns = [
    {
      id: 41,
      project: 1,
      task_name: "recompute_topic_centroid",
      task_run_id: "run-41",
      status: "completed" as const,
      started_at: "2026-04-28T08:00:00Z",
      finished_at: "2026-04-28T08:00:01Z",
      latency_ms: 523,
      error_message: "",
      summary: {
        project_id: 1,
        feedback_count: 12,
        upvote_count: 10,
        downvote_count: 2,
      },
    },
    {
      id: 42,
      project: 1,
      task_name: "generate_theme_suggestions",
      task_run_id: "run-42",
      status: alerting ? ("failed" as const) : ("completed" as const),
      started_at: "2026-04-28T08:10:00Z",
      finished_at: "2026-04-28T08:10:01Z",
      latency_ms: alerting ? 1480 : 910,
      error_message: alerting ? "OpenRouter timeout" : "",
      summary: { project_id: 1, created: 1, updated: 0, skipped: 2 },
    },
  ]
  const sourceRows = sourceConfigs.map((sourceConfig, index) => ({
    sourceConfig,
    latestRun: runs[index] ?? null,
    status:
      index === 1 && alerting
        ? ("failing" as const)
        : noSnapshots && index === 1
          ? ("degraded" as const)
          : ("healthy" as const),
  }))

  return (
    <AppShell
      title="Ingestion health"
      description="A source-by-source view of freshness, last run outcome, and whether the pipeline is idle, healthy, or failing."
      projects={projects}
      selectedProjectId={1}
    >
      <TopicCentroidPanel
        historyHref="/admin/health?project=1#centroid-snapshot-history"
        statusLabel={noSnapshots ? "idle" : "active"}
        statusTone={noSnapshots ? "neutral" : "positive"}
        summary={centroidSummary}
        trendPoints="0,66 110,58 220,49"
        visibleSnapshots={centroidSnapshots}
      />

      <TrendTaskRunsPanel
        historyHref="/admin/health?project=1#trend-task-run-history"
        statusLabel={alerting ? "failing" : noSnapshots ? "idle" : "healthy"}
        statusTone={alerting ? "negative" : noSnapshots ? "neutral" : "positive"}
        summary={{
          project: 1,
          run_count: noSnapshots ? 0 : 8,
          failed_run_count: alerting ? 1 : 0,
          latest_runs: noSnapshots ? [] : trendRuns,
        }}
        visibleRuns={noSnapshots ? [] : trendRuns}
      />

      <SourceDiversityPanel
        statusLabel={sourceDiversitySummary.latest_snapshot ? "tracked" : "idle"}
        statusTone={noSnapshots ? "neutral" : alerting ? "warning" : "positive"}
        summary={sourceDiversitySummary}
        trendPoints="0,36 110,30 220,18"
        visibleSnapshots={noSnapshots ? [] : [createSourceDiversitySnapshot({ id: 1 }), createSourceDiversitySnapshot({ id: 2, top_plugin_share: 0.7 })]}
      />

      <SourceHealthPanel
        rows={noSnapshots ? [] : sourceRows}
        statusLabel={alerting ? "mixed" : "sources"}
        statusTone={alerting ? "warning" : "neutral"}
      />
    </AppShell>
  )
}
