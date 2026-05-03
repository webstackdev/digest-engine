import type { DashboardView, DuplicateStateFilter } from "@/lib/dashboard-view"
import type { TopicClusterDetail } from "@/lib/types"

export type ContentClusterBadge = {
  clusterId: number
  label: string
  velocityScore: number | null
}

export const dashboardViewOptions: Array<{ value: DashboardView; label: string }> = [
  { value: "content", label: "Surfaced content" },
  { value: "review", label: "Pending review" },
]

export const dashboardDayOptions = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const

export const duplicateStateOptions: Array<{ value: DuplicateStateFilter; label: string }> = [
  { value: "", label: "All items" },
  { value: "duplicate_related", label: "Duplicate-related" },
]

export function buildContentClusterLookup(clusterDetails: TopicClusterDetail[]) {
  const lookup = new Map<number, ContentClusterBadge>()

  for (const clusterDetail of clusterDetails) {
    for (const membership of clusterDetail.memberships) {
      const current = lookup.get(membership.content.id)
      const candidateVelocity = clusterDetail.velocity_score ?? 0
      const currentVelocity = current?.velocityScore ?? -1

      if (!current || candidateVelocity > currentVelocity) {
        lookup.set(membership.content.id, {
          clusterId: clusterDetail.id,
          label: clusterDetail.label || `Cluster ${clusterDetail.id}`,
          velocityScore: clusterDetail.velocity_score,
        })
      }
    }
  }

  return lookup
}