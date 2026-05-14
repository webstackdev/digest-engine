import Link from "next/link"

import { StatusBadge } from "@/components/elements/StatusBadge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Entity, EntityCandidate } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatDisplayLabel } from "@/lib/view-helpers"

import { selectTriggerClassName } from "../shared"

type EntityCandidatesCardProps = {
  entities: Entity[]
  entityCandidates: EntityCandidate[]
  projectId: number
}

/** Render the pending entity-candidate queue for the selected project. */
export function EntityCandidatesCard({
  entities,
  entityCandidates,
  projectId,
}: EntityCandidatesCardProps) {
  return (
    <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
      <CardHeader className="space-y-2">
        <div className="space-y-1">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Candidate queue</p>
          <CardTitle className="font-display text-title-sm font-bold text-content-active">
            Pending entity candidates
          </CardTitle>
          <p className="m-0 text-sm leading-6 text-content-offset">
            Need cluster-level review instead of one-off actions? Open the grouped queue.
          </p>
        </div>
        <div>
          <Link
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "min-h-11 rounded-full px-4 py-3"
            )}
            href={`/entities/candidates?project=${projectId}`}
          >
            Open clustered queue
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {entityCandidates.length === 0 ? (
          <Alert className="rounded-3xl border-trim-offset bg-page-offset">
            <AlertDescription>No pending entity candidates right now.</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {entityCandidates.map((candidate) => (
              <article
                className="space-y-3 rounded-2xl border border-trim-offset bg-page-offset p-4"
                key={candidate.id}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="m-0 font-display text-lg font-bold text-content-active">
                      {candidate.name}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-content-offset">
                      <span>{formatDisplayLabel(candidate.suggested_type)}</span>
                      <span>
                        {candidate.occurrence_count} occurrence
                        {candidate.occurrence_count === 1 ? "" : "s"}
                      </span>
                      {candidate.first_seen_title ? (
                        <span>First seen in {candidate.first_seen_title}</span>
                      ) : null}
                    </div>
                  </div>
                  <StatusBadge tone="warning">{formatDisplayLabel(candidate.status)}</StatusBadge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={`/api/entity-candidates/${candidate.id}`} method="POST">
                    <input name="projectId" type="hidden" value={projectId} />
                    <input name="redirectTo" type="hidden" value={`/entities?project=${projectId}`} />
                    <input name="intent" type="hidden" value="accept" />
                    <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
                      Accept
                    </Button>
                  </form>
                  <form action={`/api/entity-candidates/${candidate.id}`} method="POST">
                    <input name="projectId" type="hidden" value={projectId} />
                    <input name="redirectTo" type="hidden" value={`/entities?project=${projectId}`} />
                    <input name="intent" type="hidden" value="reject" />
                    <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit" variant="destructive">
                      Reject
                    </Button>
                  </form>
                </div>
                <form
                  action={`/api/entity-candidates/${candidate.id}`}
                  className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                  method="POST"
                >
                  <input name="projectId" type="hidden" value={projectId} />
                  <input name="redirectTo" type="hidden" value={`/entities?project=${projectId}`} />
                  <input name="intent" type="hidden" value="merge" />
                  <div className="grid gap-2">
                    <Label htmlFor={`candidate-merge-${candidate.id}`}>
                      Merge into existing entity
                    </Label>
                    <Select defaultValue="" name="mergedInto">
                      <SelectTrigger className={selectTriggerClassName} id={`candidate-merge-${candidate.id}`}>
                        <SelectValue placeholder="Select entity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Select entity</SelectItem>
                        {entities.map((entity) => (
                          <SelectItem key={entity.id} value={String(entity.id)}>
                            {entity.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className="min-h-11 self-end rounded-full px-4 py-3"
                    size="lg"
                    type="submit"
                    variant="outline"
                  >
                    Merge
                  </Button>
                </form>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
