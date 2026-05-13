import { DraftsList } from "@/app/drafts/_components/DraftsList"
import { DraftsOverviewCards } from "@/app/drafts/_components/DraftsOverviewCards"
import { DraftsToolbar } from "@/app/drafts/_components/DraftsToolbar"
import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getProjectNewsletterDrafts, getProjects } from "@/lib/api"
import {
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type DraftsPageProps = {
  /** Search params promise containing the optional `project` and `status` selectors. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function buildDraftsPageHref(projectId: number, statusFilter: string) {
  const params = new URLSearchParams({ project: String(projectId) })
  if (statusFilter && statusFilter !== "all") {
    params.set("status", statusFilter)
  }
  return `/drafts?${params.toString()}`
}

/**
 * Render the newsletter drafts queue for the selected project.
 */
export default async function DraftsPage({ searchParams }: DraftsPageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Drafts"
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

  const drafts = await getProjectNewsletterDrafts(selectedProject.id)
  const statusFilter = String(resolvedSearchParams.status || "all")
  const filteredDrafts =
    !statusFilter || statusFilter === "all"
      ? drafts
      : drafts.filter((draft) => draft.status === statusFilter)
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)
  const currentPageHref = buildDraftsPageHref(selectedProject.id, statusFilter)

  return (
    <AppShell
      title="Newsletter drafts"
      description="Generate project-ready editions, inspect their composition status, and open a draft for editorial review."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
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

      <DraftsOverviewCards drafts={drafts} />
      <DraftsToolbar
        currentPageHref={currentPageHref}
        selectedProjectId={selectedProject.id}
        statusFilter={statusFilter}
      />
      <DraftsList drafts={filteredDrafts} selectedProjectId={selectedProject.id} />
    </AppShell>
  )
}
