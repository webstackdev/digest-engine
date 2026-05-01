import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { AppShell } from "@/components/app-shell"
import { SourceDiversityPanel } from "@/components/source-diversity-panel"
import { StatusBadge } from "@/components/status-badge"
import {
  createIngestionRun,
  createProject,
  createSourceConfig,
  createSourceDiversitySnapshot,
  createSourceDiversitySummary,
  createTopicCentroidSummary,
} from "@/lib/storybook-fixtures"

type HealthPreviewProps = {
  alerting?: boolean
  noSnapshots?: boolean
}

function HealthPagePreview({ alerting = false, noSnapshots = false }: HealthPreviewProps) {
  const projects = [createProject()]
  const centroidSummary = createTopicCentroidSummary({
    latest_snapshot: noSnapshots ? null : createTopicCentroidSummary().latest_snapshot,
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

  return (
    <AppShell
      title="Ingestion health"
      description="A source-by-source view of freshness, last run outcome, and whether the pipeline is idle, healthy, or failing."
      projects={projects}
      selectedProjectId={1}
    >
      <section className="mb-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Topic centroid observability</h2>
            <p className="mt-1 text-sm leading-6 text-muted">Representative centroid summary for the health page composition story.</p>
          </div>
          <StatusBadge tone={noSnapshots ? "neutral" : "positive"}>{noSnapshots ? "idle" : "active"}</StatusBadge>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-panel bg-muted/60 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Centroid state</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{centroidSummary.latest_snapshot ? "Active" : "Not computed"}</p>
          </div>
          <div className="rounded-panel bg-muted/60 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Avg drift vs previous</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{centroidSummary.avg_drift_from_previous ?? "n/a"}</p>
          </div>
        </div>
      </section>

      <SourceDiversityPanel
        statusLabel={sourceDiversitySummary.latest_snapshot ? "tracked" : "idle"}
        statusTone={noSnapshots ? "neutral" : alerting ? "warning" : "positive"}
        summary={sourceDiversitySummary}
        trendPoints="0,36 110,30 220,18"
        visibleSnapshots={noSnapshots ? [] : [createSourceDiversitySnapshot({ id: 1 }), createSourceDiversitySnapshot({ id: 2, top_plugin_share: 0.7 })]}
      />

      <section className="mt-4 overflow-hidden rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border/12 text-sm text-muted">
                <th className="px-3 py-4 font-medium">Source</th>
                <th className="px-3 py-4 font-medium">Status</th>
                <th className="px-3 py-4 font-medium">Latest run</th>
              </tr>
            </thead>
            <tbody>
              {sourceConfigs.map((sourceConfig, index) => (
                <tr className="border-b border-border/12 align-top last:border-b-0" key={sourceConfig.id}>
                  <td className="px-3 py-4 text-sm text-foreground">{sourceConfig.plugin_name}</td>
                  <td className="px-3 py-4">
                    <StatusBadge tone={index === 1 && alerting ? "negative" : "positive"}>
                      {index === 1 && alerting ? "failing" : "healthy"}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-4 text-sm text-foreground">{runs[index]?.status ?? "No runs yet"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  )
}

const meta = {
  title: "Pages/AdminHealth",
  component: HealthPagePreview,
  tags: ["autodocs"],
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