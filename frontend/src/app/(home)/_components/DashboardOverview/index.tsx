import { Card, CardContent } from "@/components/ui/card"

type DashboardOverviewProps = {
  surfacedCount: number
  reviewQueueCount: number
  trackedEntitiesCount: number
  positiveFeedback: number
  negativeFeedback: number
}

/** Render top-level dashboard metrics for the selected project. */
export function DashboardOverview({
  surfacedCount,
  reviewQueueCount,
  trackedEntitiesCount,
  positiveFeedback,
  negativeFeedback,
}: DashboardOverviewProps) {
  const items = [
    {
      label: "Surfaced",
      value: String(surfacedCount),
      description: "Active content items in the current filter window.",
    },
    {
      label: "Review queue",
      value: String(reviewQueueCount),
      description: "Borderline or low-confidence items waiting on an editor.",
    },
    {
      label: "Tracked entities",
      value: String(trackedEntitiesCount),
      description: "People, vendors, and organizations linked to this project.",
    },
    {
      label: "Signals",
      value: `${positiveFeedback}/${negativeFeedback}`,
      description: "Upvotes and downvotes captured through the API so far.",
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
