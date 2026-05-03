import { StatusBadge } from "@/components/elements/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Entity } from "@/lib/types"

import {
  type CandidateCluster,
  formatBlockedReason,
  selectTriggerClassName,
} from "../shared"

type CandidateClusterCardProps = {
  cluster: CandidateCluster
  entities: Entity[]
  selectedProjectId: number
}

/** Render one grouped pending-candidate review card and its bulk actions. */
export function CandidateClusterCard({
  cluster,
  entities,
  selectedProjectId,
}: CandidateClusterCardProps) {
  return (
    <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
      <CardContent className="pt-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Cluster review</p>
            <h2 className="m-0 font-display text-title-sm font-bold text-foreground">
              Cluster of {cluster.members.length} candidate
              {cluster.members.length === 1 ? "" : "s"}
            </h2>
            <div className="flex flex-wrap gap-2 text-sm text-muted">
              <span>{cluster.totalOccurrences} total occurrences</span>
              <span>{cluster.sourcePlugins.length} source families</span>
              {cluster.identitySurfaces.length > 0 ? (
                <span>{cluster.identitySurfaces.length} identity hints</span>
              ) : null}
            </div>
          </div>
          <Badge className="rounded-full px-3 py-1 text-sm" variant="outline">
            {cluster.clusterKey}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
          {cluster.sourcePlugins.map((plugin) => (
            <Badge className="rounded-full px-3 py-1 text-sm" key={`${cluster.clusterKey}:${plugin}`} variant="secondary">
              {plugin}
            </Badge>
          ))}
          {cluster.identitySurfaces.map((surface) => (
            <Badge className="rounded-full px-3 py-1 text-sm" key={`${cluster.clusterKey}:${surface}`} variant="outline">
              {surface} identity hint
            </Badge>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.95fr)]">
          <div className="space-y-3">
            {cluster.members.map((candidate) => (
              <article className="rounded-2xl border border-border/10 bg-muted/45 p-4" key={candidate.id}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="m-0 font-semibold text-foreground">{candidate.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted">
                      <span>{candidate.suggested_type}</span>
                      <span>{candidate.occurrence_count} occurrences</span>
                      <span>{candidate.evidence_count} evidence rows</span>
                      {candidate.first_seen_title ? (
                        <span>First seen in {candidate.first_seen_title}</span>
                      ) : null}
                    </div>
                  </div>
                  <StatusBadge tone="warning">{candidate.status}</StatusBadge>
                </div>
                {candidate.auto_promotion_blocked_reason ? (
                  <p className="mb-0 mt-3 text-sm leading-6 text-muted">
                    Auto-promotion blocked: {formatBlockedReason(candidate.auto_promotion_blocked_reason)}
                  </p>
                ) : null}
              </article>
            ))}
          </div>

          <div className="space-y-3 rounded-2xl border border-border/10 bg-muted/45 p-4">
            <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
              Bulk cluster actions
            </p>
            <form action={`/api/projects/${selectedProjectId}/entity-candidate-bulk`} className="flex flex-wrap gap-3" method="POST">
              <input name="redirectTo" type="hidden" value={`/entities/candidates?project=${selectedProjectId}`} />
              <input name="intent" type="hidden" value="accept" />
              {cluster.members.map((candidate) => (
                <input key={`accept-${candidate.id}`} name="candidateId" type="hidden" value={candidate.id} />
              ))}
              <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
                Accept cluster
              </Button>
            </form>

            <form action={`/api/projects/${selectedProjectId}/entity-candidate-bulk`} className="flex flex-wrap gap-3" method="POST">
              <input name="redirectTo" type="hidden" value={`/entities/candidates?project=${selectedProjectId}`} />
              <input name="intent" type="hidden" value="reject" />
              {cluster.members.map((candidate) => (
                <input key={`reject-${candidate.id}`} name="candidateId" type="hidden" value={candidate.id} />
              ))}
              <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit" variant="destructive">
                Reject cluster
              </Button>
            </form>

            <form action={`/api/projects/${selectedProjectId}/entity-candidate-bulk`} className="grid gap-3" method="POST">
              <input name="redirectTo" type="hidden" value={`/entities/candidates?project=${selectedProjectId}`} />
              <input name="intent" type="hidden" value="merge" />
              {cluster.members.map((candidate) => (
                <input key={`merge-${candidate.id}`} name="candidateId" type="hidden" value={candidate.id} />
              ))}
              <div className="grid gap-2">
                <Label htmlFor={`merge-cluster-${cluster.clusterKey}`}>Merge cluster into entity</Label>
                <Select defaultValue="" name="mergedInto">
                  <SelectTrigger className={selectTriggerClassName} id={`merge-cluster-${cluster.clusterKey}`}>
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
              <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit" variant="outline">
                Merge cluster
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}