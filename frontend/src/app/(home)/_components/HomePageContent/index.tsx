import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { DashboardView, DuplicateStateFilter } from "@/lib/dashboard-view"
import type {
  Content,
  Entity,
  Project,
  ReviewQueueItem,
  SourceConfig,
} from "@/lib/types"

import { ContentFeed } from "../ContentFeed"
import { DashboardFilterToolbar } from "../DashboardFilterToolbar"
import { DashboardOverview } from "../DashboardOverview"
import { DashboardSidebar } from "../DashboardSidebar"
import { ReviewQueueTable } from "../ReviewQueueTable"
import type { ContentClusterBadge } from "../shared"

type HomePageContentProps = {
  projects: Project[]
  selectedProject: Project
  filteredContents: Content[]
  pendingReviewItems: ReviewQueueItem[]
  entities: Entity[]
  positiveFeedback: number
  negativeFeedback: number
  contentTypes: string[]
  contentTypeFilter: string
  sources: string[]
  sourceFilter: string
  daysFilter: number
  duplicateStateFilter: DuplicateStateFilter
  view: DashboardView
  sourceConfigs: SourceConfig[]
  contentMap: Map<number, Content>
  contentClusterLookup: Map<number, ContentClusterBadge>
  errorMessage?: string
  successMessage?: string
}

/** Render the dashboard UI for one selected project. */
export function HomePageContent({
  projects,
  selectedProject,
  filteredContents,
  pendingReviewItems,
  entities,
  positiveFeedback,
  negativeFeedback,
  contentTypes,
  contentTypeFilter,
  sources,
  sourceFilter,
  daysFilter,
  duplicateStateFilter,
  view,
  sourceConfigs,
  contentMap,
  contentClusterLookup,
  errorMessage = "",
  successMessage = "",
}: HomePageContentProps) {
  return (
    <AppShell
      title={`${selectedProject.name} dashboard`}
      description="Ranked content, pending human review, and quick editorial actions backed by the current Django API."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      <DashboardOverview
        negativeFeedback={negativeFeedback}
        positiveFeedback={positiveFeedback}
        reviewQueueCount={pendingReviewItems.length}
        surfacedCount={filteredContents.length}
        trackedEntitiesCount={entities.length}
      />

      {errorMessage ? (
        <Alert className="rounded-3xl border-destructive bg-destructive" variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      {successMessage ? (
        <Alert className="rounded-3xl border-trim-offset bg-muted">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <DashboardFilterToolbar
        contentTypeFilter={contentTypeFilter}
        contentTypes={contentTypes}
        daysFilter={daysFilter}
        duplicateStateFilter={duplicateStateFilter}
        projectId={selectedProject.id}
        sourceFilter={sourceFilter}
        sources={sources}
        view={view}
      />

      {view === "review" ? (
        <ReviewQueueTable
          contentMap={contentMap}
          pendingReviewItems={pendingReviewItems}
          projectId={selectedProject.id}
        />
      ) : (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.95fr)]">
          <ContentFeed
            contentClusterLookup={contentClusterLookup}
            filteredContents={filteredContents}
            projectId={selectedProject.id}
          />
          <DashboardSidebar
            pendingReviewCount={pendingReviewItems.length}
            selectedProject={selectedProject}
            sourceConfigs={sourceConfigs}
          />
        </section>
      )}
    </AppShell>
  )
}
