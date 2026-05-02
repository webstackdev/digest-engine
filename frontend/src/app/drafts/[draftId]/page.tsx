import Link from "next/link"

import { DraftEditor } from "@/app/drafts/[draftId]/_components/DraftEditor"
import { StatusBadge } from "@/components/elements/StatusBadge"
import { AppShell } from "@/components/layout/AppShell"
import { getProjectNewsletterDraft, getProjects } from "@/lib/api"
import type { NewsletterDraftStatus } from "@/lib/types"
import {
  formatDate,
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

function buildDraftDetailHref(projectId: number, draftId: number, view: string) {
  const params = new URLSearchParams({ project: String(projectId) })
  if (view && view !== "editor") {
    params.set("view", view)
  }
  return `/drafts/${draftId}?${params.toString()}`
}

/**
 * Render one newsletter draft detail view for the selected project.
 */
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
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
          Create a project first in Django admin.
        </div>
      </AppShell>
    )
  }

  const resolvedDraftId = Number.parseInt(draftId, 10)
  const draft = await getProjectNewsletterDraft(selectedProject.id, resolvedDraftId)
  const view = String(resolvedSearchParams.view || "editor")
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
        <div className="rounded-panel bg-destructive/14 px-4 py-4 text-sm leading-6 text-destructive">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
      ) : null}

      <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Status</p>
          <div className="mt-2">
            <StatusBadge tone={draftTone(draft.status)}>{draft.status}</StatusBadge>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted">Generated {formatDate(draft.generated_at)}</p>
        </article>
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Sections</p>
          <p className="mt-1 text-3xl font-bold">{draft.sections.length}</p>
          <p className="text-sm leading-6 text-muted">Theme-backed sections in this edition.</p>
        </article>
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Original pieces</p>
          <p className="mt-1 text-3xl font-bold">{draft.original_pieces.length}</p>
          <p className="text-sm leading-6 text-muted">Accepted original ideas carried into the draft.</p>
        </article>
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Target publish</p>
          <p className="mt-1 text-3xl font-bold">{draft.target_publish_date || "Unscheduled"}</p>
          <p className="text-sm leading-6 text-muted">
            {draft.last_edited_at ? `Last edited ${formatDate(draft.last_edited_at)}` : "No manual edits yet."}
          </p>
        </article>
      </section>

      <section className="mb-4 flex flex-wrap items-center gap-3 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
          href={buildDraftDetailHref(selectedProject.id, draft.id, "editor")}
        >
          Editor view
        </Link>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
          href={buildDraftDetailHref(selectedProject.id, draft.id, "markdown")}
        >
          Markdown export
        </Link>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
          href={buildDraftDetailHref(selectedProject.id, draft.id, "html")}
        >
          HTML export
        </Link>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
          href={`/drafts?project=${selectedProject.id}`}
        >
          Back to drafts
        </Link>
      </section>

      {view === "markdown" ? (
        <section className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Rendered markdown</p>
          <pre className="mt-4 overflow-auto rounded-2xl bg-sidebar/95 p-4 text-sm text-sidebar-foreground">
            {draft.rendered_markdown}
          </pre>
        </section>
      ) : null}

      {view === "html" ? (
        <section className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Rendered HTML</p>
          <article
            className="prose prose-sm mt-4 max-w-none text-foreground dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: draft.rendered_html }}
          />
        </section>
      ) : null}

      {view === "editor" ? (
        <DraftEditor
          currentPageHref={currentPageHref}
          draft={draft}
          projectId={selectedProject.id}
        />
      ) : null}
    </AppShell>
  )
}