import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type {
  Entity,
  EntityAuthoritySnapshot,
  EntityMentionSummary,
  Project,
  ProjectConfig,
} from "@/lib/types"

import { AuthorityHistoryPanel } from "../AuthorityHistoryPanel"
import { EntityMentionsPanel } from "../EntityMentionsPanel"
import { EntityOverviewCard } from "../EntityOverviewCard"
import { EntitySidebar } from "../EntitySidebar"

type EntityDetailPageContentProps = {
  authorityComponents: EntityAuthoritySnapshot | null
  authorityHistory: EntityAuthoritySnapshot[]
  entity: Entity
  errorMessage?: string | null
  mentions: EntityMentionSummary[]
  projectConfig: ProjectConfig | null
  projects: Project[]
  selectedProject: Project
  siblingEntities: Entity[]
  successMessage?: string | null
}

/** Compose the entity detail route shell and route-local sections. */
export function EntityDetailPageContent({
  authorityComponents,
  authorityHistory,
  entity,
  errorMessage,
  mentions,
  projectConfig,
  projects,
  selectedProject,
  siblingEntities,
  successMessage,
}: EntityDetailPageContentProps) {
  return (
    <AppShell
      description="Inspect authority inputs, identity links, and extracted mention history for a tracked entity."
      projects={projects}
      selectedProjectId={selectedProject.id}
      title="Entity detail"
    >
      <div className="space-y-4">
        {errorMessage ? (
          <Alert className="rounded-panel border-destructive/20 bg-destructive/14" variant="destructive">
            <AlertDescription className="text-destructive">{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        {successMessage ? (
          <Alert className="rounded-panel border-border/12 bg-muted/60">
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.9fr)]">
          <div className="space-y-4">
            <EntityOverviewCard entity={entity} />
            <AuthorityHistoryPanel
              authorityComponents={authorityComponents}
              authorityHistory={authorityHistory}
              entity={entity}
              projectConfig={projectConfig}
              projectId={selectedProject.id}
              redirectTo={`/entities/${entity.id}?project=${selectedProject.id}`}
              userRole={selectedProject.user_role}
            />
            <EntityMentionsPanel mentions={mentions} projectId={selectedProject.id} />
          </div>

          <EntitySidebar selectedProjectId={selectedProject.id} siblingEntities={siblingEntities} />
        </section>
      </div>
    </AppShell>
  )
}
