import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { StatusBadge } from "@/components/status-badge"
import {
  getProjectEntities,
  getProjectEntity,
  getProjectEntityMentions,
  getProjects,
} from "@/lib/api"
import {
  formatDate,
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type EntityDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the detail view for one tracked entity in the selected project.
 *
 * The page joins the entity record with its extracted mention history so editors can
 * inspect how the pipeline is linking content to the entity over time.
 *
 * @param props - Async server component props from the App Router.
 * @param props.params - Route params promise containing the entity id.
 * @param props.searchParams - Search params promise containing the optional `project`, `error`, and `message` values.
 * @returns The rendered entity detail page or the no-project empty state.
 */
export default async function EntityDetailPage({
  params,
  searchParams,
}: EntityDetailPageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams])
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Entity detail"
        description="No project is available for the configured API user."
        projects={[]}
        selectedProjectId={null}
      >
        <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
          Create a project first in Django admin.
        </div>
      </AppShell>
    )
  }

  const entityId = Number.parseInt(id, 10)
  const [entity, mentions, projectEntities] = await Promise.all([
    getProjectEntity(selectedProject.id, entityId),
    getProjectEntityMentions(selectedProject.id, entityId),
    getProjectEntities(selectedProject.id),
  ])
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)
  const siblingEntities = projectEntities.filter((candidate) => candidate.id !== entity.id)

  return (
    <AppShell
      title="Entity detail"
      description="Inspect authority inputs, identity links, and extracted mention history for a tracked entity."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      {errorMessage ? (
        <div className="rounded-panel bg-danger/14 px-4 py-4 text-sm leading-6 text-danger-ink">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.9fr)]">
        <div className="space-y-4">
          <article className="space-y-5 rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Tracked entity</p>
                <h2 className="m-0 font-display text-title-lg font-bold text-ink">
                  {entity.name}
                </h2>
                <div className="flex flex-wrap gap-2 text-sm text-muted">
                  <span>Created {formatDate(entity.created_at)}</span>
                  <span>{entity.mention_count} mention{entity.mention_count === 1 ? "" : "s"}</span>
                  <span>Authority {entity.authority_score.toFixed(2)}</span>
                </div>
              </div>
              <StatusBadge tone="neutral">{entity.type}</StatusBadge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-ink/10 bg-surface-strong/45 p-4">
                <h3 className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                  Description
                </h3>
                <p className="m-0 text-sm leading-7 text-ink">
                  {entity.description || "No description is set for this entity yet."}
                </p>
              </div>
              <div className="space-y-3 rounded-2xl border border-ink/10 bg-surface-strong/45 p-4">
                <h3 className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                  Identity links
                </h3>
                <ul className="m-0 grid list-none gap-2 p-0 text-sm text-muted">
                  {entity.website_url ? (
                    <li>
                      <a className="text-ink transition hover:text-primary" href={entity.website_url} target="_blank">
                        Website
                      </a>
                    </li>
                  ) : null}
                  {entity.github_url ? (
                    <li>
                      <a className="text-ink transition hover:text-primary" href={entity.github_url} target="_blank">
                        GitHub
                      </a>
                    </li>
                  ) : null}
                  {entity.linkedin_url ? (
                    <li>
                      <a className="text-ink transition hover:text-primary" href={entity.linkedin_url} target="_blank">
                        LinkedIn
                      </a>
                    </li>
                  ) : null}
                  {entity.bluesky_handle ? <li>Bluesky {entity.bluesky_handle}</li> : null}
                  {entity.mastodon_handle ? <li>Mastodon {entity.mastodon_handle}</li> : null}
                  {entity.twitter_handle ? <li>Twitter {entity.twitter_handle}</li> : null}
                  {!entity.website_url &&
                  !entity.github_url &&
                  !entity.linkedin_url &&
                  !entity.bluesky_handle &&
                  !entity.mastodon_handle &&
                  !entity.twitter_handle ? (
                    <li>No external identity links are set yet.</li>
                  ) : null}
                </ul>
              </div>
            </div>
          </article>

          <article className="space-y-4 rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Mention history</p>
                <h3 className="m-0 font-display text-title-sm font-bold text-ink">
                  Extracted mentions linked to this entity
                </h3>
              </div>
              <span className="text-sm text-muted">{mentions.length} total mention{mentions.length === 1 ? "" : "s"}</span>
            </div>
            {mentions.length === 0 ? (
              <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
                No extracted mentions exist for this entity yet.
              </div>
            ) : (
              <ul className="m-0 grid list-none gap-3 p-0">
                {mentions.map((mention) => (
                  <li key={mention.id} className="rounded-2xl border border-ink/10 bg-surface-strong/45 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <Link
                          className="font-medium text-ink transition hover:text-primary"
                          href={`/content/${mention.content_id}?project=${selectedProject.id}`}
                        >
                          {mention.content_title}
                        </Link>
                        <div className="flex flex-wrap gap-2 text-sm text-muted">
                          <span>{mention.role}</span>
                          {mention.sentiment ? <span>{mention.sentiment}</span> : null}
                          <span>{Math.round(mention.confidence * 100)}% confidence</span>
                          <span>{formatDate(mention.created_at)}</span>
                        </div>
                      </div>
                      {mention.span ? (
                        <span className="inline-flex items-center rounded-full border border-ink/12 bg-surface px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-muted">
                          {mention.span}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>

        <div className="space-y-4">
          <article className="space-y-4 rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Navigation</p>
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105"
                href={`/entities?project=${selectedProject.id}`}
              >
                Back to entities
              </Link>
            </div>
          </article>

          <article className="space-y-4 rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
            <div>
              <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Related entities</p>
              <h3 className="m-0 font-display text-title-sm font-bold text-ink">
                Same-project entities
              </h3>
            </div>
            {siblingEntities.length === 0 ? (
              <p className="m-0 text-sm leading-6 text-muted">
                No other entities exist in this project yet.
              </p>
            ) : (
              <ul className="m-0 grid list-none gap-3 p-0">
                {siblingEntities.slice(0, 6).map((siblingEntity) => (
                  <li key={siblingEntity.id} className="rounded-2xl border border-ink/10 bg-surface-strong/45 p-4">
                    <Link
                      className="font-medium text-ink transition hover:text-primary"
                      href={`/entities/${siblingEntity.id}?project=${selectedProject.id}`}
                    >
                      {siblingEntity.name}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted">
                      <span>{siblingEntity.type}</span>
                      <span>{siblingEntity.mention_count} mention{siblingEntity.mention_count === 1 ? "" : "s"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </section>
    </AppShell>
  )
}