import Link from "next/link"

import { StatusBadge } from "@/components/elements/StatusBadge"
import { AppShell } from "@/components/layout/AppShell"
import { getProjectNewsletterDrafts, getProjects } from "@/lib/api"
import type { NewsletterDraft, NewsletterDraftStatus } from "@/lib/types"
import {
  formatDate,
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

function draftTone(status: NewsletterDraftStatus) {
  switch (status) {
    case "ready":
    case "published":
      return "positive" as const
    case "discarded":
      return "negative" as const
    default:
      return "warning" as const
  }
}

function countDraftsByStatus(drafts: NewsletterDraft[], status: NewsletterDraftStatus) {
  return drafts.filter((draft) => draft.status === status).length
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
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
          Create a project first in Django admin.
        </div>
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
        <div className="rounded-panel bg-destructive/14 px-4 py-4 text-sm leading-6 text-destructive">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
      ) : null}

      <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Generating</p>
          <p className="mt-1 text-3xl font-bold">{countDraftsByStatus(drafts, "generating")}</p>
          <p className="text-sm leading-6 text-muted">Drafts currently being composed.</p>
        </article>
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Ready</p>
          <p className="mt-1 text-3xl font-bold">{countDraftsByStatus(drafts, "ready")}</p>
          <p className="text-sm leading-6 text-muted">Drafts ready for editorial review.</p>
        </article>
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Edited</p>
          <p className="mt-1 text-3xl font-bold">{countDraftsByStatus(drafts, "edited")}</p>
          <p className="text-sm leading-6 text-muted">Drafts with local editorial changes.</p>
        </article>
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Published</p>
          <p className="mt-1 text-3xl font-bold">{countDraftsByStatus(drafts, "published")}</p>
          <p className="text-sm leading-6 text-muted">Drafts marked published in the backend.</p>
        </article>
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Discarded</p>
          <p className="mt-1 text-3xl font-bold">{countDraftsByStatus(drafts, "discarded")}</p>
          <p className="text-sm leading-6 text-muted">Drafts that ended in an error state.</p>
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
              <option value="all">All drafts</option>
              <option value="generating">Generating</option>
              <option value="ready">Ready</option>
              <option value="edited">Edited</option>
              <option value="published">Published</option>
              <option value="discarded">Discarded</option>
            </select>
            <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
              Apply filter
            </button>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
              href={`/drafts?project=${selectedProject.id}`}
            >
              Reset
            </Link>
          </div>
        </form>

        <form action={`/api/projects/${selectedProject.id}/drafts/generate`} method="POST">
          <input type="hidden" name="redirectTo" value={currentPageHref} />
          <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
            Generate now
          </button>
        </form>
      </section>

      <section className="space-y-4">
        {filteredDrafts.length === 0 ? (
          <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
            No newsletter drafts matched the current filter.
          </div>
        ) : null}

        {filteredDrafts.map((draft) => (
          <article key={draft.id} className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Draft #{draft.id}</p>
                <h2 className="font-display text-title-md font-bold text-foreground">{draft.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{draft.intro || "No intro has been added yet."}</p>
              </div>
              <StatusBadge tone={draftTone(draft.status)}>{draft.status}</StatusBadge>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
              <span>Generated {formatDate(draft.generated_at)}</span>
              <span>{draft.sections.length} section{draft.sections.length === 1 ? "" : "s"}</span>
              <span>{draft.original_pieces.length} original piece{draft.original_pieces.length === 1 ? "" : "s"}</span>
              <span>Target publish {draft.target_publish_date || "Unscheduled"}</span>
              {draft.last_edited_at ? <span>Edited {formatDate(draft.last_edited_at)}</span> : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                href={`/drafts/${draft.id}?project=${selectedProject.id}`}
              >
                Open draft
              </Link>
              {draft.generation_metadata.models ? (
                <span className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground">
                  Composer {draft.generation_metadata.models.section_composer || "pending"}
                </span>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </AppShell>
  )
}
