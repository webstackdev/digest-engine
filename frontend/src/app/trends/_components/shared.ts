import type { TopicVelocitySnapshot } from "@/lib/types"

export const trendDaysOptions = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const

/** Build an SVG sparkline from persisted topic velocity snapshots. */
export function buildVelocityTrendPoints(snapshots: TopicVelocitySnapshot[]) {
  if (snapshots.length <= 1) {
    return "0,56 220,56"
  }

  const orderedSnapshots = snapshots
    .slice()
    .sort(
      (left, right) =>
        new Date(left.computed_at).getTime() - new Date(right.computed_at).getTime(),
    )

  return orderedSnapshots
    .map((snapshot, index) => {
      const x = (index / (orderedSnapshots.length - 1)) * 220
      const y = 64 - (snapshot.velocity_score ?? 0) * 56
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
}
