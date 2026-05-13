import { DraftEditor } from "@/app/drafts/[draftId]/_components/DraftEditor"
import { DraftOverviewCards } from "@/app/drafts/[draftId]/_components/DraftOverviewCards"
import { DraftRenderedOutput } from "@/app/drafts/[draftId]/_components/DraftRenderedOutput"
import {
  buildDraftDetailHref,
  type DraftView,
  DraftViewSwitcher,
} from "@/app/drafts/[draftId]/_components/DraftViewSwitcher"
import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getProjectNewsletterDraft, getProjects } from "@/lib/api"
import {
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type DraftDetailPageProps = {
  /** Route params promise containing the draft id. */
  params: Promise<{ draftId: string }>
  /** Search params promise containing the optional `project`, `view`, `error`, and `message` values. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function resolveView(value: string | string[] | undefined): DraftView {
  return value === "markdown" || value === "html" ? value : "editor"
}

/** Render one newsletter draft detail view for the selected project. */
export default async function DraftDetailPage({
  params,
  searchParams,
}: DraftDetailPageProps) {
  const [{ draftId }, resolvedSearchParams] = await Promise.all([params, searchParams])
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Draft detail"
        description="No project is available for the configured API user."
        projects={[]}
        selectedProjectId={null}
      >
        <Alert className="rounded-panel border-border bg-muted">
          <AlertDescription>Create a project first in Django admin.</AlertDescription>
        </Alert>
      </AppShell>
    )
  }

  const resolvedDraftId = Number.parseInt(draftId, 10)
  const draft = await getProjectNewsletterDraft(selectedProject.id, resolvedDraftId)
  const view = resolveView(resolvedSearchParams.view)
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)
  const currentPageHref = buildDraftDetailHref(selectedProject.id, draft.id, view)

  return (
    <AppShell
      title="Draft detail"
      description="Review the current draft tree, export its rendered output, and trigger targeted section regeneration."
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

      <DraftOverviewCards draft={draft} />
      <DraftViewSwitcher
        currentView={view}
        draftId={draft.id}
        selectedProjectId={selectedProject.id}
      />

      {view === "editor" ? (
        <DraftEditor
          currentPageHref={currentPageHref}
          draft={draft}
          projectId={selectedProject.id}
        />
      ) : (
        <DraftRenderedOutput draft={draft} view={view} />
      )}
    </AppShell>
  )
}
