import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Entity, EntityCandidate, Project } from "@/lib/types"

import { CreateEntityCard } from "../CreateEntityCard"
import { EntityCandidatesCard } from "../EntityCandidatesCard"
import { EntityCard } from "../EntityCard"

type EntitiesPageContentProps = {
  entities: Entity[]
  entityCandidates: EntityCandidate[]
  errorMessage?: string | null
  projects: Project[]
  selectedProjectId: number
  successMessage?: string | null
}

/** Compose the entities route shell, flash messages, and primary route-local sections. */
export function EntitiesPageContent({
  entities,
  entityCandidates,
  errorMessage,
  projects,
  selectedProjectId,
  successMessage,
}: EntitiesPageContentProps) {
  return (
    <AppShell
      description="Create, update, and remove the people and organizations that anchor relevance for this project."
      projects={projects}
      selectedProjectId={selectedProjectId}
      title="Entity management"
    >
      <div className="space-y-4">
        {errorMessage ? (
          <Alert className="rounded-panel border-destructive/25 bg-destructive/14" variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        {successMessage ? (
          <Alert className="rounded-panel border-border/12 bg-muted/60">
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.65fr)]">
          <div className="space-y-4">
            <CreateEntityCard projectId={selectedProjectId} />
            <EntityCandidatesCard
              entities={entities}
              entityCandidates={entityCandidates}
              projectId={selectedProjectId}
            />
          </div>

          <div className="space-y-4">
            {entities.length === 0 ? (
              <Alert className="rounded-panel border-border/12 bg-muted/60">
                <AlertDescription>No entities exist for this project yet.</AlertDescription>
              </Alert>
            ) : null}
            {entities.map((entity) => (
              <EntityCard entity={entity} key={entity.id} projectId={selectedProjectId} />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}