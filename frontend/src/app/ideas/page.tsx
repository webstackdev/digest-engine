import { IdeasQueueOverview } from "@/app/ideas/_components/IdeasQueueOverview"
import { IdeasToolbarCard } from "@/app/ideas/_components/IdeasToolbarCard"
import { OriginalContentIdeaCard } from "@/app/ideas/_components/OriginalContentIdeaCard"
import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getProjectOriginalContentIdeas, getProjects } from "@/lib/api"
import { getErrorMessage, getSuccessMessage, selectProject } from "@/lib/view-helpers"

import { DEFAULT_IDEA_DISMISSAL_REASONS } from "./_components/shared"

type IdeasPageProps = {
  /** Search params promise containing the optional `project` and `status` selectors. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function buildIdeasPageHref(projectId: number, statusFilter: string) {
  const params = new URLSearchParams({ project: String(projectId) })
  if (statusFilter && statusFilter !== "all") {
    params.set("status", statusFilter)
  }
  return `/ideas?${params.toString()}`
}

/**
 * Render the original-content ideas queue for the selected project.
 */
export default async function IdeasPage({ searchParams }: IdeasPageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Ideas"
        description="No project found for this API user."
        projects={[]}
        selectedProjectId={null}
      >
        <Alert className="rounded-panel border-border/10 bg-muted/60">
          <AlertDescription>Create a project first in Django admin.</AlertDescription>
        </Alert>
      </AppShell>
    )
  }

  const ideas = await getProjectOriginalContentIdeas(selectedProject.id)
  const statusFilter = String(resolvedSearchParams.status || "all")
  const filteredIdeas =
    !statusFilter || statusFilter === "all"
      ? ideas
      : ideas.filter((idea) => idea.status === statusFilter)
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)
  const pendingCount = ideas.filter((idea) => idea.status === "pending").length
  const acceptedCount = ideas.filter((idea) => idea.status === "accepted").length
  const writtenCount = ideas.filter((idea) => idea.status === "written").length
  const dismissedCount = ideas.filter((idea) => idea.status === "dismissed").length
  const currentPageHref = buildIdeasPageHref(selectedProject.id, statusFilter)

  return (
    <AppShell
      title="Original content ideas"
      description="Review project-owned article angles, trigger fresh ideation, and move accepted ideas through the editorial workflow."
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

      <IdeasQueueOverview
        acceptedCount={acceptedCount}
        dismissedCount={dismissedCount}
        pendingCount={pendingCount}
        writtenCount={writtenCount}
      />

      <IdeasToolbarCard
        currentPageHref={currentPageHref}
        projectId={selectedProject.id}
        statusFilter={statusFilter}
      />

      <section className="space-y-4">
        {filteredIdeas.length === 0 ? (
          <Alert className="rounded-panel border-border/10 bg-muted/60">
            <AlertDescription>No original-content ideas matched the current filter.</AlertDescription>
          </Alert>
        ) : null}

        {filteredIdeas.map((idea) => (
          <OriginalContentIdeaCard
            currentPageHref={currentPageHref}
            dismissalReasons={DEFAULT_IDEA_DISMISSAL_REASONS}
            idea={idea}
            key={idea.id}
            projectId={selectedProject.id}
          />
        ))}
      </section>
    </AppShell>
  )
}
