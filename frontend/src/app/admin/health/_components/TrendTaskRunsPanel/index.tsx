import Link from "next/link"
import type { ComponentProps } from "react"

import { StatusBadge } from "@/components/elements/StatusBadge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  TrendTaskRun,
  TrendTaskRunObservabilitySummary,
} from "@/lib/types"
import { formatDate, formatDisplayLabel } from "@/lib/view-helpers"

const TREND_TASK_LABELS: Record<string, string> = {
  recompute_topic_centroid: "Topic centroid",
  recompute_topic_clusters: "Topic clusters",
  recompute_topic_velocity: "Topic velocity",
  recompute_source_diversity: "Source diversity",
  generate_theme_suggestions: "Theme suggestions",
  generate_original_content_ideas: "Original content ideas",
}

const TREND_TASK_DETAIL_LABELS: Record<string, string> = {
  feedback_count: "feedback",
  upvote_count: "upvotes",
  downvote_count: "downvotes",
  contents_considered: "content",
  clusters_updated: "clusters updated",
  clusters_evaluated: "clusters evaluated",
  snapshots_created: "snapshots",
  content_count: "content",
  alert_count: "alerts",
  created: "created",
  updated: "updated",
  skipped: "skipped",
}

function formatLatency(value: number | null) {
  if (value === null) {
    return "n/a"
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`
  }
  return `${value}ms`
}

function trendTaskRunTone(status: TrendTaskRun["status"]) {
  if (status === "failed") {
    return "negative"
  }
  if (status === "started") {
    return "warning"
  }
  if (status === "skipped") {
    return "neutral"
  }
  return "positive"
}

function formatTrendTaskName(taskName: string) {
  return TREND_TASK_LABELS[taskName] ?? taskName.replaceAll("_", " ")
}

function buildTrendTaskRunSummaryText(taskRun: TrendTaskRun) {
  const detailParts = Object.entries(taskRun.summary)
    .filter(([key, value]) => key !== "project_id" && key !== "snapshot_id" && value !== null)
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 3)
    .map(([key, value]) => `${TREND_TASK_DETAIL_LABELS[key] ?? key.replaceAll("_", " ")} ${String(value)}`)

  if (detailParts.length === 0) {
    return "No task summary recorded yet."
  }

  return detailParts.join(" • ")
}

type TrendTaskRunsPanelProps = {
  /** Project-level trend task summary. */
  summary: TrendTaskRunObservabilitySummary
  /** Visible persisted task runs for the history table. */
  visibleRuns: TrendTaskRun[]
  /** Semantic tone for the overall section status. */
  statusTone: ComponentProps<typeof StatusBadge>["tone"]
  /** Visible label for the overall section status. */
  statusLabel: string
  /** Deep link to the history section. */
  historyHref: string
}

/** Render trend pipeline status and recent persisted runs for the health page. */
export function TrendTaskRunsPanel({
  summary,
  visibleRuns,
  statusTone,
  statusLabel,
  historyHref,
}: TrendTaskRunsPanelProps) {
  return (
    <>
      <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
        <CardHeader>
          <h2 className="font-heading text-base leading-snug font-medium">
            Trend pipeline runs
          </h2>
          <CardDescription>
            The latest persisted run for each tracked trend task, including task outcome, runtime, and any recorded failure message.
          </CardDescription>
          <CardAction>
            <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="rounded-3xl bg-muted shadow-none ring-0" size="sm">
              <CardContent>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
                  Persisted runs
                </p>
                <p className="mt-2 text-2xl font-semibold text-content-active">
                  {summary.run_count}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl bg-muted shadow-none ring-0" size="sm">
              <CardContent>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
                  Latest task rows
                </p>
                <p className="mt-2 text-2xl font-semibold text-content-active">
                  {summary.latest_runs.length}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl bg-muted shadow-none ring-0" size="sm">
              <CardContent>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
                  Failed runs
                </p>
                <p className="mt-2 text-2xl font-semibold text-content-active">
                  {summary.failed_run_count}
                </p>
              </CardContent>
            </Card>
          </div>

          {summary.latest_runs.length === 0 ? (
            <Card className="rounded-3xl bg-muted shadow-none ring-0" size="sm">
              <CardContent className="text-sm leading-6 text-muted">
                No trend pipeline runs have been persisted for this project yet.
              </CardContent>
            </Card>
          ) : (
            <>
              {visibleRuns.length > 0 ? (
                <Link
                  aria-label="Open trend task run history"
                  className="block rounded-3xl bg-muted px-4 py-4 transition hover:bg-muted"
                  href={historyHref}
                >
                  <div className="flex items-center justify-between gap-3 text-sm text-muted">
                    <span>Recent task history</span>
                    <span>Last {visibleRuns.length} persisted runs</span>
                  </div>
                </Link>
              ) : null}

              <Table>
                <TableHeader>
                  <TableRow className="border-trim-offset text-sm text-muted hover:bg-transparent">
                    <TableHead className="px-3 py-4">Task</TableHead>
                    <TableHead className="px-3 py-4">Status</TableHead>
                    <TableHead className="px-3 py-4">Started</TableHead>
                    <TableHead className="px-3 py-4">Duration</TableHead>
                    <TableHead className="px-3 py-4">Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.latest_runs.map((taskRun) => (
                    <TableRow key={taskRun.id} className="border-trim-offset align-top">
                      <TableCell className="px-3 py-4 text-sm font-medium text-content-active">
                        {formatTrendTaskName(taskRun.task_name)}
                      </TableCell>
                      <TableCell className="px-3 py-4">
                        <StatusBadge tone={trendTaskRunTone(taskRun.status)}>
                          {formatDisplayLabel(taskRun.status)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="px-3 py-4 text-sm text-content-active">
                        {formatDate(taskRun.started_at)}
                      </TableCell>
                      <TableCell className="px-3 py-4 text-sm text-content-active">
                        {formatLatency(taskRun.latency_ms)}
                      </TableCell>
                      <TableCell className="px-3 py-4 whitespace-normal text-sm leading-6 text-muted">
                        <p>{buildTrendTaskRunSummaryText(taskRun)}</p>
                        {taskRun.error_message ? (
                          <p className="mt-1 text-destructive">{taskRun.error_message}</p>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <Card
        className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl"
        id="trend-task-run-history"
      >
        <CardHeader>
          <h2 className="font-heading text-base leading-snug font-medium">
            Trend task run history
          </h2>
          <CardDescription>
            Recent persisted executions across the trend pipeline, including run duration, summary output, and the latest recorded failures.
          </CardDescription>
          <CardAction>
            <span className="text-sm text-muted">
              Showing {visibleRuns.length} of {summary.run_count} runs
            </span>
          </CardAction>
        </CardHeader>

        <CardContent>
          {visibleRuns.length === 0 ? (
            <Card className="rounded-3xl bg-muted shadow-none ring-0" size="sm">
              <CardContent className="text-sm leading-6 text-muted">
                No trend task run history exists for this project yet.
              </CardContent>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-trim-offset text-sm text-muted hover:bg-transparent">
                  <TableHead className="px-3 py-4">Started</TableHead>
                  <TableHead className="px-3 py-4">Task</TableHead>
                  <TableHead className="px-3 py-4">Status</TableHead>
                  <TableHead className="px-3 py-4">Finished</TableHead>
                  <TableHead className="px-3 py-4">Duration</TableHead>
                  <TableHead className="px-3 py-4">Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRuns.map((taskRun) => (
                  <TableRow key={taskRun.id} className="border-trim-offset align-top">
                    <TableCell className="px-3 py-4 text-sm text-content-active">
                      {formatDate(taskRun.started_at)}
                    </TableCell>
                    <TableCell className="px-3 py-4 text-sm font-medium text-content-active">
                      {formatTrendTaskName(taskRun.task_name)}
                    </TableCell>
                    <TableCell className="px-3 py-4">
                      <StatusBadge tone={trendTaskRunTone(taskRun.status)}>
                        {formatDisplayLabel(taskRun.status)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="px-3 py-4 text-sm text-content-active">
                      {formatDate(taskRun.finished_at)}
                    </TableCell>
                    <TableCell className="px-3 py-4 text-sm text-content-active">
                      {formatLatency(taskRun.latency_ms)}
                    </TableCell>
                    <TableCell className="px-3 py-4 whitespace-normal text-sm leading-6 text-muted">
                      <p>{buildTrendTaskRunSummaryText(taskRun)}</p>
                      {taskRun.error_message ? (
                        <p className="mt-1 text-destructive">{taskRun.error_message}</p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
