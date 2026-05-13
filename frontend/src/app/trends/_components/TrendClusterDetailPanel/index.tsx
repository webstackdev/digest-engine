import Link from "next/link"

import { StatusBadge } from "@/components/elements/StatusBadge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Content, TopicClusterDetail } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  formatDate,
  formatDisplayLabel,
  formatPercentScore,
  formatScore,
  truncateText,
} from "@/lib/view-helpers"

import { buildVelocityTrendPoints } from "../shared"

type TrendClusterDetailPanelProps = {
  projectId: number
  selectedCluster: TopicClusterDetail | null
  contentMap: Map<number, Content>
}

/** Render the selected cluster detail and member content drill-down. */
export function TrendClusterDetailPanel({
  projectId,
  selectedCluster,
  contentMap,
}: TrendClusterDetailPanelProps) {
  if (!selectedCluster) {
    return (
      <Alert className="rounded-3xl border-trim-offset bg-muted">
        <AlertDescription>
          Select a cluster to inspect its member content and velocity history.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Cluster detail</p>
            <h2 className="font-display text-title-md font-bold text-content-active">
              {selectedCluster.label || `Cluster ${selectedCluster.id}`}
            </h2>
            <p className="mt-2 text-sm leading-6 text-content-offset">
              {selectedCluster.dominant_entity
                ? `${selectedCluster.dominant_entity.name} leads this cluster.`
                : "This cluster does not have a dominant entity yet."}
            </p>
          </div>
          <StatusBadge tone={(selectedCluster.velocity_score ?? 0) >= 0.7 ? "positive" : "warning"}>
            Velocity {formatPercentScore(selectedCluster.velocity_score)}
          </StatusBadge>
        </div>

        {selectedCluster.velocity_history.length > 1 ? (
          <div className="mt-4 rounded-3xl bg-muted px-4 py-4">
            <div className="flex items-center justify-between gap-3 text-sm text-content-offset">
              <span>Velocity history</span>
              <span>{selectedCluster.velocity_history.length} snapshots</span>
            </div>
            <svg
              aria-label="Velocity history trend"
              className="mt-3 h-20 w-full overflow-visible text-content-active"
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
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {selectedCluster.memberships.map((membership) => {
            const content = contentMap.get(membership.content.id)

            return (
              <article
                className="rounded-3xl border border-trim-offset bg-muted p-4"
                key={membership.id}
              >
                <div className="flex flex-wrap items-center gap-2 text-sm text-content-offset">
                  <span>{formatDisplayLabel(membership.content.source_plugin)}</span>
                  <span>{formatDate(membership.content.published_date)}</span>
                  <span>Similarity {formatScore(membership.similarity)}</span>
                </div>
                <h3 className="mt-3 font-display text-title-sm font-bold text-content-active">
                  {membership.content.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-content-offset">
                  {truncateText(content?.content_text || membership.content.title)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm text-content-offset">
                  <span>
                    Adjusted {formatPercentScore(content?.authority_adjusted_score ?? content?.relevance_score ?? null)}
                  </span>
                  {content?.newsletter_promotion_at ? (
                    <span>Promoted {formatDate(content.newsletter_promotion_at)}</span>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    className={cn(buttonVariants({ size: "lg" }), "min-h-11 rounded-full px-4 py-3")}
                    href={`/content/${membership.content.id}?project=${projectId}`}
                  >
                    Open detail
                  </Link>
                  <Link
                    className={cn(buttonVariants({ size: "lg", variant: "outline" }), "min-h-11 rounded-full px-4 py-3")}
                    href={membership.content.url}
                    target="_blank"
                  >
                    Open source
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
