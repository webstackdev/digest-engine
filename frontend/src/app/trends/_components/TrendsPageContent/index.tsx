import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Content, Project, TopicClusterDetail } from "@/lib/types"

import { TopicClusterCard } from "../TopicClusterCard"
import { TrendClusterDetailPanel } from "../TrendClusterDetailPanel"
import { TrendsFilterToolbar } from "../TrendsFilterToolbar"
import { TrendsQueueOverview } from "../TrendsQueueOverview"

type TrendsPageContentProps = {
  projects: Project[]
  selectedProject: Project
  filteredClusterDetails: TopicClusterDetail[]
  selectedCluster: TopicClusterDetail | null
  contentMap: Map<number, Content>
  availableSources: string[]
  sourceFilter: string
  daysFilter: number
  averageVelocityScore: number | null
  errorMessage?: string
  successMessage?: string
}

function buildTrendHref(projectId: number, filters: { source: string; days: number }, clusterId: number) {
  const params = new URLSearchParams({
    project: String(projectId),
    days: String(filters.days),
    cluster: String(clusterId),
  })
  if (filters.source) {
    params.set("source", filters.source)
  }
  return `/trends?${params.toString()}`
}

/** Render the trends workspace for one selected project. */
export function TrendsPageContent({
  projects,
  selectedProject,
  filteredClusterDetails,
  selectedCluster,
  contentMap,
  availableSources,
  sourceFilter,
  daysFilter,
  averageVelocityScore,
  errorMessage = "",
  successMessage = "",
}: TrendsPageContentProps) {
  return (
    <AppShell
      title="Trend analysis"
      description="Cluster velocity, member content, and editorial context for the topics accelerating inside this project."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      {errorMessage ? (
        <Alert className="rounded-panel border-destructive/20 bg-destructive/10" variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      {successMessage ? (
        <Alert className="rounded-panel border-border/10 bg-muted/60">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <TrendsQueueOverview
        averageVelocityScore={averageVelocityScore}
        contentCount={contentMap.size}
        daysFilter={daysFilter}
        visibleClusterCount={filteredClusterDetails.length}
      />

      <TrendsFilterToolbar
        availableSources={availableSources}
        daysFilter={daysFilter}
        projectId={selectedProject.id}
        sourceFilter={sourceFilter}
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(300px,0.95fr)_minmax(0,1.65fr)]">
        <div className="space-y-4">
          {filteredClusterDetails.length === 0 ? (
            <Alert className="rounded-panel border-border/10 bg-muted/60">
              <AlertDescription>No topic clusters matched the current filters.</AlertDescription>
            </Alert>
          ) : null}
          {filteredClusterDetails.map((cluster) => {
            const trendHref = buildTrendHref(
              selectedProject.id,
              { source: sourceFilter, days: daysFilter },
              cluster.id,
            )
            const isSelected = selectedCluster?.id === cluster.id

            return (
              <TopicClusterCard
                cluster={cluster}
                href={trendHref}
                isSelected={isSelected}
                key={cluster.id}
              />
            )
          })}
        </div>

        <div className="space-y-4">
          <TrendClusterDetailPanel
            contentMap={contentMap}
            projectId={selectedProject.id}
            selectedCluster={selectedCluster}
          />
        </div>
      </section>
    </AppShell>
  )
}
