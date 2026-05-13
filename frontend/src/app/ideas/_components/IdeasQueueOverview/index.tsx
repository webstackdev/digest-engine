import { Card, CardContent } from "@/components/ui/card"

type IdeasQueueOverviewProps = {
  pendingCount: number
  acceptedCount: number
  writtenCount: number
  dismissedCount: number
}

/** Render the top-line counts for the original-content idea workflow. */
export function IdeasQueueOverview({
  pendingCount,
  acceptedCount,
  writtenCount,
  dismissedCount,
}: IdeasQueueOverviewProps) {
  const metrics = [
    {
      label: "Pending",
      value: pendingCount,
      description: "Ideas waiting for an editor decision.",
    },
    {
      label: "Accepted",
      value: acceptedCount,
      description: "Ideas the editor has queued for writing.",
    },
    {
      label: "Written",
      value: writtenCount,
      description: "Accepted ideas already marked complete.",
    },
    {
      label: "Dismissed",
      value: dismissedCount,
      description: "Ideas that were reviewed and intentionally rejected.",
    },
  ]

  return (
    <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card
          className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl"
          key={metric.label}
        >
          <CardContent className="pt-4">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">{metric.label}</p>
            <p className="mt-1 text-3xl font-bold">{metric.value}</p>
            <p className="text-sm leading-6 text-muted">{metric.description}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
