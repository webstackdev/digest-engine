import type { ComponentProps } from "react"

import { StatusBadge } from "@/components/elements/StatusBadge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import type {
  SourceDiversityObservabilitySummary,
  SourceDiversitySnapshot,
} from "@/lib/types"
import { formatPercentScore } from "@/lib/view-helpers"

type SourceDiversityPanelProps = {
  /** Aggregate source-diversity summary for the selected project. */
  summary: SourceDiversityObservabilitySummary
  /** Snapshot rows currently visualized in the trend area. */
  visibleSnapshots: SourceDiversitySnapshot[]
  /** SVG polyline points for the top-plugin-share trend. */
  trendPoints: string
  /** Semantic tone for the summary badge. */
  statusTone: ComponentProps<typeof StatusBadge>["tone"]
  /** Visible summary label for the status badge. */
  statusLabel: string
}

function renderShareBar(share: number) {
  return (
    <svg
      aria-hidden="true"
      className="mt-2 h-2 w-full"
      preserveAspectRatio="none"
      viewBox="0 0 100 8"
    >
      <rect className="fill-muted" height="8" rx="4" width="100" x="0" y="0" />
      <rect
        className="fill-primary"
        height="8"
        rx="4"
        width={Math.max(Math.round(share * 100), 4)}
        x="0"
        y="0"
      />
    </svg>
  )
}

/**
 * Render the source-diversity observability panel shared by the health page and stories.
 */
export function SourceDiversityPanel({
  summary,
  visibleSnapshots,
  trendPoints,
  statusTone,
  statusLabel,
}: SourceDiversityPanelProps) {
  return (
    <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
      <CardHeader>
        <h2 className="font-heading text-base leading-snug font-medium">
          Source diversity
        </h2>
        <CardDescription>
          Entropy, source concentration, and advisory alerts derived from the latest source-diversity snapshot.
        </CardDescription>
        <CardAction>
          <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        {summary.latest_snapshot ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Card className="rounded-panel bg-muted/60 shadow-none ring-0" size="sm">
                <CardContent>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Plugin diversity
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {formatPercentScore(summary.latest_snapshot.plugin_entropy)}
                  </p>
                </CardContent>
              </Card>
              <Card className="rounded-panel bg-muted/60 shadow-none ring-0" size="sm">
                <CardContent>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Source diversity
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {formatPercentScore(summary.latest_snapshot.source_entropy)}
                  </p>
                </CardContent>
              </Card>
              <Card className="rounded-panel bg-muted/60 shadow-none ring-0" size="sm">
                <CardContent>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Author diversity
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {formatPercentScore(summary.latest_snapshot.author_entropy)}
                  </p>
                </CardContent>
              </Card>
              <Card className="rounded-panel bg-muted/60 shadow-none ring-0" size="sm">
                <CardContent>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Cluster diversity
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {formatPercentScore(summary.latest_snapshot.cluster_entropy)}
                  </p>
                </CardContent>
              </Card>
              <Card className="rounded-panel bg-muted/60 shadow-none ring-0" size="sm">
                <CardContent>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Top plugin share
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {formatPercentScore(summary.latest_snapshot.top_plugin_share)}
                  </p>
                </CardContent>
              </Card>
              <Card className="rounded-panel bg-muted/60 shadow-none ring-0" size="sm">
                <CardContent>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Top source share
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {formatPercentScore(summary.latest_snapshot.top_source_share)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {visibleSnapshots.length > 1 ? (
              <Card className="rounded-panel bg-muted/60 shadow-none ring-0" size="sm">
                <CardContent>
                  <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span>Top plugin share trend</span>
                    <span>Last {visibleSnapshots.length} snapshots</span>
                  </div>
                  <svg
                    aria-label="Source diversity trend"
                    className="mt-3 h-20 w-full overflow-visible text-foreground"
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
                </CardContent>
              </Card>
            ) : null}

            {(summary.latest_snapshot.breakdown.alerts ?? []).length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {summary.latest_snapshot.breakdown.alerts.map((alert) => (
                  <Card
                    key={alert.code}
                    className="rounded-panel bg-secondary/70 text-secondary-foreground shadow-none ring-0"
                    size="sm"
                  >
                    <CardContent>
                      <strong className="font-medium">{alert.code}</strong>
                      <p className="mt-2 m-0 text-sm leading-6">{alert.message}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="rounded-panel bg-muted/60 shadow-none ring-0" size="sm">
                <CardContent className="text-sm leading-6 text-muted-foreground">
                  No source-diversity alerts are active for this project.
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="rounded-panel bg-muted/60 shadow-none ring-0" size="sm">
                <CardContent>
                  <p className="m-0 text-sm font-medium text-foreground">Top plugin buckets</p>
                  <div className="mt-3 space-y-3">
                    {summary.latest_snapshot.breakdown.plugin_counts.slice(0, 4).map((item) => (
                      <div key={item.key}>
                        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                          <span>{item.label}</span>
                          <span>{formatPercentScore(item.share)}</span>
                        </div>
                        {renderShareBar(item.share)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-panel bg-muted/60 shadow-none ring-0" size="sm">
                <CardContent>
                  <p className="m-0 text-sm font-medium text-foreground">Top source buckets</p>
                  <div className="mt-3 space-y-3">
                    {summary.latest_snapshot.breakdown.source_counts.slice(0, 4).map((item) => (
                      <div key={item.key}>
                        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                          <span>{item.label}</span>
                          <span>{formatPercentScore(item.share)}</span>
                        </div>
                        {renderShareBar(item.share)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <details className="rounded-panel bg-muted/60 px-4 py-4">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                View raw breakdown JSON
              </summary>
              <pre className="mt-3 overflow-auto rounded-2xl bg-sidebar/95 p-4 text-sm text-sidebar-foreground">
                {JSON.stringify(summary.latest_snapshot.breakdown, null, 2)}
              </pre>
            </details>
          </>
        ) : (
          <Card className="rounded-panel bg-muted/60 shadow-none ring-0" size="sm">
            <CardContent className="text-sm leading-6 text-muted-foreground">
              No source-diversity snapshots exist for this project yet.
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  )
}
