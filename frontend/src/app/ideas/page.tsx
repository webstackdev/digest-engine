import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import {
  DEFAULT_IDEA_DISMISSAL_REASONS,
  OriginalContentIdeaCard,
} from "@/components/original-content-idea-card"
import { getProjectOriginalContentIdeas, getProjects } from "@/lib/api"
import { getErrorMessage, getSuccessMessage, selectProject } from "@/lib/view-helpers"

type IdeasPageProps = {
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
 *
 * @param props - Async server component props from the App Router.
 * @param props.searchParams - Search params promise containing the optional `project` and `status` selectors.
 * @returns The rendered ideas page or the no-project empty state.
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
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
          Create a project first in Django admin.
        </div>
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
        <div className="rounded-panel bg-destructive/14 px-4 py-4 text-sm leading-6 text-destructive">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
      ) : null}

      <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Pending</p>
          <p className="mt-1 text-3xl font-bold">{pendingCount}</p>
          <p className="text-sm leading-6 text-muted">Ideas waiting for an editor decision.</p>
        </article>
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Accepted</p>
          <p className="mt-1 text-3xl font-bold">{acceptedCount}</p>
          <p className="text-sm leading-6 text-muted">Ideas the editor has queued for writing.</p>
        </article>
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Written</p>
          <p className="mt-1 text-3xl font-bold">{writtenCount}</p>
          <p className="text-sm leading-6 text-muted">Accepted ideas already marked complete.</p>
        </article>
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Dismissed</p>
          <p className="mt-1 text-3xl font-bold">{dismissedCount}</p>
          <p className="text-sm leading-6 text-muted">Ideas that were reviewed and intentionally rejected.</p>
        </article>
      </section>

      <section className="mb-4 flex flex-col gap-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl xl:flex-row xl:items-end xl:justify-between">
        <form className="grid gap-2" method="GET">
          <input type="hidden" name="project" value={selectedProject.id} />
          <label className="text-sm font-medium text-foreground" htmlFor="status">Status</label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="min-h-11 rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              defaultValue={statusFilter}
              id="status"
              name="status"
            >
              <option value="all">All ideas</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="written">Written</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
              Apply filter
            </button>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
              href={`/ideas?project=${selectedProject.id}`}
            >
              Reset
            </Link>
          </div>
        </form>

        <form action={`/api/projects/${selectedProject.id}/ideas/generate`} method="POST">
          <input type="hidden" name="redirectTo" value={currentPageHref} />
          <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
            Generate now
          </button>
        </form>
      </section>

      <section className="space-y-4">
        {filteredIdeas.length === 0 ? (
          <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
            No original-content ideas matched the current filter.
          </div>
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
