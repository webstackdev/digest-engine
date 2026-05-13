import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type CandidateQueueOverviewProps = {
  activeTab: string
  clusterCount: number
  pendingCount: number
  resolvedCount: number
  selectedProjectId: number
}

/** Render the queue summary cards and route-local tab navigation. */
export function CandidateQueueOverview({
  activeTab,
  clusterCount,
  pendingCount,
  resolvedCount,
  selectedProjectId,
}: CandidateQueueOverviewProps) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
          <CardContent className="pt-4">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Clusters</p>
            <p className="mt-1 text-3xl font-bold">{clusterCount}</p>
            <p className="text-sm leading-6 text-muted">
              Grouped review cards for pending candidates.
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
          <CardContent className="pt-4">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Pending</p>
            <p className="mt-1 text-3xl font-bold">{pendingCount}</p>
            <p className="text-sm leading-6 text-muted">
              Candidates still waiting for editorial action or auto-promotion.
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
          <CardContent className="pt-4">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Auto-promotion log</p>
            <p className="mt-1 text-3xl font-bold">{resolvedCount}</p>
            <p className="text-sm leading-6 text-muted">
              Accepted, rejected, or merged candidates already resolved.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
        <CardContent className="flex flex-wrap gap-3 pt-4">
          <Link
            className={cn(
              buttonVariants({ size: "lg", variant: activeTab === "review" ? "default" : "outline" }),
              "min-h-11 rounded-full px-4 py-3"
            )}
            href={`/entities/candidates?project=${selectedProjectId}`}
          >
            Review clusters
          </Link>
          <Link
            className={cn(
              buttonVariants({ size: "lg", variant: activeTab === "auto-log" ? "default" : "outline" }),
              "min-h-11 rounded-full px-4 py-3"
            )}
            href={`/entities/candidates?project=${selectedProjectId}&tab=auto-log`}
          >
            Auto-promotion log
          </Link>
          <Link
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "min-h-11 rounded-full px-4 py-3"
            )}
            href={`/entities?project=${selectedProjectId}`}
          >
            Back to entities
          </Link>
        </CardContent>
      </Card>
    </>
  )
}
