import Link from "next/link"

import { StatusBadge } from "@/components/ui/StatusBadge"
import type { TopicCluster, TopicClusterDetail } from "@/lib/types"
import { formatDate, formatPercentScore, formatScore } from "@/lib/view-helpers"

type TopicClusterCardProps = {
  cluster: TopicCluster | TopicClusterDetail
  href: string
  isSelected?: boolean
}

/**
 * Render a compact trend cluster card used by the trends page and Storybook previews.
 *
 * @param props - Topic cluster card props.
 * @returns A linked card summarizing one topic cluster.
 */
export function TopicClusterCard({
  cluster,
  href,
  isSelected = false,
}: TopicClusterCardProps) {
  return (
    <Link
      className={`block rounded-3xl border p-5 shadow-panel backdrop-blur-xl transition hover:-translate-y-0.5 ${
        isSelected ? "border-primary/25 bg-primary/7" : "border-border/12 bg-card/85"
      }`}
      href={href}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Cluster</p>
          <h3 className="font-display text-title-sm font-bold text-foreground">
            {cluster.label || `Cluster ${cluster.id}`}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            {cluster.dominant_entity
              ? `Dominant entity: ${cluster.dominant_entity.name}`
              : "No dominant entity has been resolved yet."}
          </p>
        </div>
        <StatusBadge tone={(cluster.velocity_score ?? 0) >= 0.7 ? "positive" : "warning"}>
          {formatPercentScore(cluster.velocity_score)}
        </StatusBadge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
        <span>{cluster.member_count} members</span>
        <span>Z {formatScore(cluster.z_score)}</span>
        <span>Window {cluster.window_count ?? 0}</span>
        <span>Last seen {formatDate(cluster.last_seen_at)}</span>
      </div>
    </Link>
  )
}