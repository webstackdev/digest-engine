import type { EntityCandidate } from "@/lib/types"

export type CandidateCluster = {
  clusterKey: string
  members: EntityCandidate[]
  totalOccurrences: number
  sourcePlugins: string[]
  identitySurfaces: string[]
}

export const selectTriggerClassName =
  "w-full rounded-2xl border-border bg-card px-4 py-3 text-sm data-[size=default]:h-11"

export function groupCandidateClusters(
  candidates: EntityCandidate[],
): CandidateCluster[] {
  const grouped = new Map<string, EntityCandidate[]>()

  for (const candidate of candidates) {
    const clusterKey = candidate.cluster_key || `candidate-${candidate.id}`
    const existing = grouped.get(clusterKey) ?? []
    existing.push(candidate)
    grouped.set(clusterKey, existing)
  }

  return Array.from(grouped.entries())
    .map(([clusterKey, members]) => ({
      clusterKey,
      members: members
        .slice()
        .sort((left, right) => right.occurrence_count - left.occurrence_count),
      totalOccurrences: members.reduce(
        (sum, candidate) => sum + candidate.occurrence_count,
        0,
      ),
      sourcePlugins: Array.from(
        new Set(members.flatMap((candidate) => candidate.source_plugins)),
      ).sort(),
      identitySurfaces: Array.from(
        new Set(members.flatMap((candidate) => candidate.identity_surfaces)),
      ).sort(),
    }))
    .sort((left, right) => right.totalOccurrences - left.totalOccurrences)
}

export function formatBlockedReason(reason: string) {
  return reason.replaceAll("_", " ")
}
