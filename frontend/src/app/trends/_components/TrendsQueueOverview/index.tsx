import { Card, CardContent } from "@/components/ui/card"
import { formatPercentScore } from "@/lib/view-helpers"

type TrendsQueueOverviewProps = {
  visibleClusterCount: number
  averageVelocityScore: number | null
  daysFilter: number
  contentCount: number
}

/** Render summary metrics for the trends workspace. */
export function TrendsQueueOverview({
  visibleClusterCount,
  averageVelocityScore,
  daysFilter,
  contentCount,
}: TrendsQueueOverviewProps) {
  const items = [
    {
      label: "Visible clusters",
      value: String(visibleClusterCount),
      description: "Clusters matching the current source and date filters.",
    },
    {
      label: "Avg velocity",
      value: formatPercentScore(averageVelocityScore),
      description: "Average normalized acceleration across the visible clusters.",
    },
    {
      label: "Window",
      value: `${daysFilter}d`,
      description: "Recent member content considered when filtering clusters.",
    },
    {
      label: "Tracked content",
      value: String(contentCount),
      description: "Project content rows available for cluster drill-down context.",
    },
  ]

  return (
    <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card
          className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl"
          key={item.label}
        >
          <CardContent className="p-5">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">{item.label}</p>
            <p className="mt-1 text-3xl font-bold">{item.value}</p>
            <p className="text-sm leading-6 text-content-offset">{item.description}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
