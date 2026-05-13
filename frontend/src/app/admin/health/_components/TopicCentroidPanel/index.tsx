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
  TopicCentroidObservabilitySummary,
  TopicCentroidSnapshot,
} from "@/lib/types"
import { formatDate } from "@/lib/view-helpers"

function formatDriftPercent(value: number | null) {
  if (value === null) {
    return "n/a"
  }
  return `${(value * 100).toFixed(1)}%`
}

type TopicCentroidPanelProps = {
  /** Aggregate centroid summary for the selected project. */
  summary: TopicCentroidObservabilitySummary
  /** Recent centroid snapshots shown in the summary sparkline and history table. */
  visibleSnapshots: TopicCentroidSnapshot[]
  /** SVG polyline points for the drift trend line. */
  trendPoints: string
  /** Semantic tone for the summary badge. */
  statusTone: ComponentProps<typeof StatusBadge>["tone"]
  /** Visible label for the centroid status badge. */
  statusLabel: string
  /** Deep link to the snapshot history section. */
  historyHref: string
}

/** Render centroid observability summary and history for the admin health page. */
export function TopicCentroidPanel({
  summary,
  visibleSnapshots,
  trendPoints,
  statusTone,
  statusLabel,
  historyHref,
}: TopicCentroidPanelProps) {
  return (
    <>
      <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
        <CardHeader>
          <h2 className="font-heading text-base leading-snug font-medium">
            Topic centroid observability
          </h2>
          <CardDescription>
            The latest centroid state for this project, plus average drift across persisted snapshot history.
          </CardDescription>
          <CardAction>
            <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-3xl bg-muted shadow-none ring-0" size="sm">
              <CardContent>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-content-offset">
                  Centroid state
                </p>
                <p className="mt-2 text-2xl font-semibold text-content-active">
                  {summary.latest_snapshot
                    ? summary.latest_snapshot.centroid_active
                      ? "Active"
                      : "Inactive"
                    : "Not computed"}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl bg-muted shadow-none ring-0" size="sm">
              <CardContent>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-content-offset">
                  Avg drift vs previous
                </p>
                <p className="mt-2 text-2xl font-semibold text-content-active">
                  {formatDriftPercent(summary.avg_drift_from_previous)}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl bg-muted shadow-none ring-0" size="sm">
              <CardContent>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-content-offset">
                  Avg drift vs 7d
                </p>
                <p className="mt-2 text-2xl font-semibold text-content-active">
                  {formatDriftPercent(summary.avg_drift_from_week_ago)}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl bg-muted shadow-none ring-0" size="sm">
              <CardContent>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-content-offset">
                  Latest snapshot
                </p>
                <p className="mt-2 text-2xl font-semibold text-content-active">
                  {formatDate(summary.latest_snapshot?.computed_at ?? null)}
                </p>
              </CardContent>
            </Card>
          </div>

          {visibleSnapshots.length > 1 ? (
            <Link
              aria-label="Open centroid snapshot history"
              className="block rounded-3xl bg-muted px-4 py-4 transition hover:bg-muted"
              href={historyHref}
            >
              <div className="flex items-center justify-between gap-3 text-sm text-content-offset">
                <span>Recent drift trend</span>
                <span>Last {visibleSnapshots.length} snapshots</span>
              </div>
              <svg
                aria-label="Centroid drift trend"
                className="mt-3 h-20 w-full overflow-visible text-content-active"
                role="img"
                viewBox="0 0 220 72"
              >
                <polyline
                  fill="none"
                  points={trendPoints}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                />
              </svg>
            </Link>
          ) : null}

          {summary.latest_snapshot ? (
            <div className="flex flex-wrap gap-3 text-sm text-content-active">
              <span>{summary.snapshot_count} snapshots</span>
              <span>{summary.active_snapshot_count} active snapshots</span>
              <span>Feedback {summary.latest_snapshot.feedback_count}</span>
              <span>Upvotes {summary.latest_snapshot.upvote_count}</span>
              <span>Downvotes {summary.latest_snapshot.downvote_count}</span>
            </div>
          ) : (
            <Card className="rounded-3xl bg-muted shadow-none ring-0" size="sm">
              <CardContent className="text-sm leading-6 text-content-offset">
                No centroid snapshots exist for this project yet.
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card
        className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl"
        id="centroid-snapshot-history"
      >
        <CardHeader>
          <h2 className="font-heading text-base leading-snug font-medium">
            Centroid snapshot history
          </h2>
          <CardDescription>
            Recent centroid recomputations for this project, including feedback volume and drift between snapshots.
          </CardDescription>
          <CardAction>
            <span className="text-sm text-content-offset">
              Showing {visibleSnapshots.length} of {summary.snapshot_count} snapshots
            </span>
          </CardAction>
        </CardHeader>

        <CardContent>
          {visibleSnapshots.length === 0 ? (
            <Card className="rounded-3xl bg-muted shadow-none ring-0" size="sm">
              <CardContent className="text-sm leading-6 text-content-offset">
                No centroid snapshot history exists for this project yet.
              </CardContent>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-trim-offset text-sm text-muted hover:bg-transparent">
                  <TableHead className="px-3 py-4">Computed</TableHead>
                  <TableHead className="px-3 py-4">State</TableHead>
                  <TableHead className="px-3 py-4">Feedback</TableHead>
                  <TableHead className="px-3 py-4">Drift vs previous</TableHead>
                  <TableHead className="px-3 py-4">Drift vs 7d</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleSnapshots.map((snapshot) => (
                  <TableRow key={snapshot.id} className="border-trim-offset align-top">
                    <TableCell className="px-3 py-4 text-sm text-content-active">
                      {formatDate(snapshot.computed_at)}
                    </TableCell>
                    <TableCell className="px-3 py-4">
                      <StatusBadge tone={snapshot.centroid_active ? "positive" : "warning"}>
                        {snapshot.centroid_active ? "active" : "inactive"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="px-3 py-4 text-sm text-content-active">
                      {snapshot.feedback_count} total
                    </TableCell>
                    <TableCell className="px-3 py-4 text-sm text-content-active">
                      {formatDriftPercent(snapshot.drift_from_previous)}
                    </TableCell>
                    <TableCell className="px-3 py-4 text-sm text-content-active">
                      {formatDriftPercent(snapshot.drift_from_week_ago)}
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
