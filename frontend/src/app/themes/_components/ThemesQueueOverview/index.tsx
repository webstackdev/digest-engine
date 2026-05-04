import { Card, CardContent } from "@/components/ui/card"

type ThemesQueueOverviewProps = {
  pendingCount: number
  acceptedCount: number
  dismissedCount: number
  totalCount: number
}

/** Render queue-level metrics for the theme suggestions page. */
export function ThemesQueueOverview({
  pendingCount,
  acceptedCount,
  dismissedCount,
  totalCount,
}: ThemesQueueOverviewProps) {
  const items = [
    {
      label: "Pending",
      value: pendingCount,
      description: "Themes waiting for an editor decision.",
    },
    {
      label: "Accepted or used",
      value: acceptedCount,
      description: "Themes already promoted into downstream editorial work.",
    },
    {
      label: "Dismissed",
      value: dismissedCount,
      description: "Themes the editor intentionally ruled out.",
    },
    {
      label: "Total themes",
      value: totalCount,
      description: "Persisted theme suggestions available for this project.",
    },
  ]

  return (
    <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card
          className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl"
          key={item.label}
        >
          <CardContent className="p-5">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">{item.label}</p>
            <p className="mt-1 text-3xl font-bold">{item.value}</p>
            <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
