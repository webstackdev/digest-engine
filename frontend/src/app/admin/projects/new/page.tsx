import { AppShell } from "@/components/app-shell"
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
        <div className="rounded-panel bg-danger/14 px-4 py-4 text-sm leading-6 text-danger-ink">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
      ) : null}

      <article className="space-y-4 rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
        <div className="space-y-1">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Provision</p>
          <h2 className="m-0 font-display text-title-sm font-bold text-ink">
            New project
          </h2>
        </div>

        <form action="/api/projects" className="space-y-4" method="POST">
          <input type="hidden" name="redirectTo" value="/admin/projects/new" />
          <label className="grid gap-2">
            <span className="text-sm font-medium text-ink">Name</span>
            <input
              className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              name="name"
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-ink">Topic description</span>
            <textarea
              className="min-h-32 w-full resize-y rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              name="topic_description"
              required
            />
          </label>
          <label className="grid gap-2 sm:max-w-xs">
            <span className="text-sm font-medium text-ink">Content retention days</span>
            <input
              className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              defaultValue="365"
              min="1"
              name="content_retention_days"
              type="number"
            />
          </label>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105"
            type="submit"
          >
            Create project
          </button>
        </form>
      </article>
    </AppShell>
  )
}
