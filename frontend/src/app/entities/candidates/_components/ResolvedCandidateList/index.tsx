import { StatusBadge } from "@/components/elements/StatusBadge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { EntityCandidate } from "@/lib/types"
import { formatDate } from "@/lib/view-helpers"

type ResolvedCandidateListProps = {
  resolvedCandidates: EntityCandidate[]
}

/** Render the resolved entity-candidate log for the selected project. */
export function ResolvedCandidateList({
  resolvedCandidates,
}: ResolvedCandidateListProps) {
  if (resolvedCandidates.length === 0) {
    return (
      <Alert className="rounded-panel border-border/12 bg-muted/60">
        <AlertDescription>
          No auto-promotion or review history is available for this project yet.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <section className="space-y-4">
      {resolvedCandidates.map((candidate) => (
        <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl" key={candidate.id}>
          <CardContent className="pt-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <h2 className="m-0 font-display text-title-sm font-bold text-foreground">
                  {candidate.name}
                </h2>
                <div className="flex flex-wrap gap-2 text-sm text-muted">
                  <span>{candidate.occurrence_count} occurrences</span>
                  <span>{candidate.source_plugin_count} sources</span>
                  <span>Resolved {formatDate(candidate.updated_at)}</span>
                  {candidate.merged_into_name ? (
                    <span>Merged into {candidate.merged_into_name}</span>
                  ) : null}
                </div>
              </div>
              <StatusBadge tone={candidate.status === "rejected" ? "negative" : "positive"}>
                {candidate.status}
              </StatusBadge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
              {candidate.source_plugins.map((plugin) => (
                <Badge className="rounded-full px-3 py-1 text-sm" key={`${candidate.id}:${plugin}`} variant="secondary">
                  {plugin}
                </Badge>
              ))}
              {candidate.identity_surfaces.map((surface) => (
                <Badge className="rounded-full px-3 py-1 text-sm" key={`${candidate.id}:${surface}`} variant="outline">
                  {surface} identity hint
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
