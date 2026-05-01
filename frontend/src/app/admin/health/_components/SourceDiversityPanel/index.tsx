import { StatusBadge } from "@/components/ui/StatusBadge"
import type {
  SourceDiversityObservabilitySummary,
  SourceDiversitySnapshot,
} from "@/lib/types"
import { formatPercentScore } from "@/lib/view-helpers"

type SourceDiversityPanelProps = {
  summary: SourceDiversityObservabilitySummary
  visibleSnapshots: SourceDiversitySnapshot[]
  trendPoints: string
  statusTone: "positive" | "warning" | "negative" | "neutral"
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
 *
 * @param props - Source diversity panel props.
 * @returns The rendered source-diversity panel.
 */
export function SourceDiversityPanel({
  summary,
  visibleSnapshots,
  trendPoints,
  statusTone,
  statusLabel,
}: SourceDiversityPanelProps) {
  return (
    <section className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Source diversity</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Entropy, source concentration, and advisory alerts derived from the latest source-diversity snapshot.
          </p>
        </div>
        <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
      </div>

      {summary.latest_snapshot ? (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-panel bg-muted/60 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Plugin diversity</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatPercentScore(summary.latest_snapshot.plugin_entropy)}
              </p>
            </div>
            <div className="rounded-panel bg-muted/60 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Source diversity</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatPercentScore(summary.latest_snapshot.source_entropy)}
              </p>
            </div>
            <div className="rounded-panel bg-muted/60 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Author diversity</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatPercentScore(summary.latest_snapshot.author_entropy)}
              </p>
            </div>
            <div className="rounded-panel bg-muted/60 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Cluster diversity</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatPercentScore(summary.latest_snapshot.cluster_entropy)}
              </p>
            </div>
            <div className="rounded-panel bg-muted/60 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Top plugin share</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatPercentScore(summary.latest_snapshot.top_plugin_share)}
              </p>
            </div>
            <div className="rounded-panel bg-muted/60 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Top source share</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatPercentScore(summary.latest_snapshot.top_source_share)}
              </p>
            </div>
          </div>

          {visibleSnapshots.length > 1 ? (
            <div className="mt-4 rounded-panel bg-muted/60 px-4 py-4">
              <div className="flex items-center justify-between gap-3 text-sm text-muted">
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
            </div>
          ) : null}

          {(summary.latest_snapshot.breakdown.alerts ?? []).length > 0 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {summary.latest_snapshot.breakdown.alerts.map((alert) => (
                <div key={alert.code} className="rounded-panel bg-secondary/70 px-4 py-4 text-sm leading-6 text-secondary-foreground">
                  <strong className="font-medium">{alert.code}</strong>
                  <p className="mt-2 m-0">{alert.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
              No source-diversity alerts are active for this project.
            </div>
          )}

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-panel bg-muted/60 px-4 py-4">
              <p className="m-0 text-sm font-medium text-foreground">Top plugin buckets</p>
              <div className="mt-3 space-y-3">
                {summary.latest_snapshot.breakdown.plugin_counts.slice(0, 4).map((item) => (
                  <div key={item.key}>
                    <div className="flex items-center justify-between gap-3 text-sm text-muted">
                      <span>{item.label}</span>
                      <span>{formatPercentScore(item.share)}</span>
                    </div>
                    {renderShareBar(item.share)}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-panel bg-muted/60 px-4 py-4">
              <p className="m-0 text-sm font-medium text-foreground">Top source buckets</p>
              <div className="mt-3 space-y-3">
                {summary.latest_snapshot.breakdown.source_counts.slice(0, 4).map((item) => (
                  <div key={item.key}>
                    <div className="flex items-center justify-between gap-3 text-sm text-muted">
                      <span>{item.label}</span>
                      <span>{formatPercentScore(item.share)}</span>
                    </div>
                    {renderShareBar(item.share)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <details className="mt-4 rounded-panel bg-muted/60 px-4 py-4">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              View raw breakdown JSON
            </summary>
            <pre className="mt-3 overflow-auto rounded-2xl bg-sidebar/95 p-4 text-sm text-sidebar-foreground">
              {JSON.stringify(summary.latest_snapshot.breakdown, null, 2)}
            </pre>
          </details>
        </>
      ) : (
        <div className="mt-4 rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
          No source-diversity snapshots exist for this project yet.
        </div>
      )}
    </section>
  )
}
