import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  getProjectEntities,
  getProjectEntityCandidates,
  getProjects,
} from "@/lib/api"
import {
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

import { CandidateClusterCard } from "./_components/CandidateClusterCard"
import { CandidateQueueOverview } from "./_components/CandidateQueueOverview"
import { ResolvedCandidateList } from "./_components/ResolvedCandidateList"
import { groupCandidateClusters } from "./_components/shared"

type CandidateQueuePageProps = {
  /** Search params promise containing the active project and optional tab/flash state. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the clustered entity-candidate review queue for one project.
 */
export default async function CandidateQueuePage({
  searchParams,
}: CandidateQueuePageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Entity candidates"
        description="No project found for this API user."
        projects={[]}
        selectedProjectId={null}
      >
        <Alert className="rounded-panel border-border bg-muted">
          <AlertDescription>Create a project first in Django admin.</AlertDescription>
        </Alert>
      </AppShell>
    )
  }

  const [entities, candidates] = await Promise.all([
    getProjectEntities(selectedProject.id),
    getProjectEntityCandidates(selectedProject.id),
  ])
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)
  const activeTab = String(resolvedSearchParams.tab || "review")
  const pendingCandidates = candidates.filter((candidate) => candidate.status === "pending")
  const resolvedCandidates = candidates
    .filter((candidate) => candidate.status !== "pending")
    .slice()
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
  const candidateClusters = groupCandidateClusters(pendingCandidates)

  return (
    <AppShell
      title="Entity candidate clusters"
      description="Review clustered candidate groups, batch editorial actions, and inspect the latest auto-promotion outcomes."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      <div className="space-y-4">
        {errorMessage ? (
          <Alert className="rounded-panel border-destructive bg-destructive" variant="destructive">
            <AlertDescription className="text-destructive">{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        {successMessage ? (
          <Alert className="rounded-panel border-border bg-muted">
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        ) : null}

        <CandidateQueueOverview
          activeTab={activeTab}
          clusterCount={candidateClusters.length}
          pendingCount={pendingCandidates.length}
          resolvedCount={resolvedCandidates.length}
          selectedProjectId={selectedProject.id}
        />

        {activeTab === "auto-log" ? (
          <ResolvedCandidateList resolvedCandidates={resolvedCandidates} />
        ) : (
          <section className="space-y-4">
            {candidateClusters.length === 0 ? (
              <Alert className="rounded-panel border-border bg-muted">
                <AlertDescription>
                  No pending candidate clusters need review right now.
                </AlertDescription>
              </Alert>
            ) : null}

            {candidateClusters.map((cluster) => (
              <CandidateClusterCard
                cluster={cluster}
                entities={entities}
                key={cluster.clusterKey}
                selectedProjectId={selectedProject.id}
              />
            ))}
          </section>
        )}
      </div>
    </AppShell>
  )
}
