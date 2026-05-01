import { AppShell } from "@/components/layout/AppShell"
import { getProjects } from "@/lib/api"
import {
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type NewProjectPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the self-service project creation page.
 *
 * @param props - Async server component props from the App Router.
 * @param props.searchParams - Search params promise containing optional flash-message values.
 * @returns The project creation workspace.
 */
export default async function NewProjectPage({ searchParams }: NewProjectPageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)

  return (
    <AppShell
      title="Create project"
      description="Spin up a new editorial workspace and become its first project admin automatically."
      projects={projects}
      selectedProjectId={selectedProject?.id ?? null}
    >
      {errorMessage ? (
        <div className="rounded-panel bg-destructive/14 px-4 py-4 text-sm leading-6 text-destructive">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
      ) : null}

      <article className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
        <div className="space-y-1">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Provision</p>
          <h2 className="m-0 font-display text-title-sm font-bold text-foreground">
            New project
          </h2>
        </div>

        <form action="/api/projects" className="space-y-4" method="POST">
          <input type="hidden" name="redirectTo" value="/admin/projects/new" />
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Name</span>
            <input
              className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              name="name"
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Topic description</span>
            <textarea
              className="min-h-32 w-full resize-y rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              name="topic_description"
              required
            />
          </label>
          <label className="grid gap-2 sm:max-w-xs">
            <span className="text-sm font-medium text-foreground">Content retention days</span>
            <input
              className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              defaultValue="365"
              min="1"
              name="content_retention_days"
              type="number"
            />
          </label>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105"
            type="submit"
          >
            Create project
          </button>
        </form>
      </article>
    </AppShell>
  )
}
