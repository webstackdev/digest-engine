import Link from "next/link"

import { AppShell } from "@/components/layout/AppShell"
import { StatusBadge } from "@/components/ui/StatusBadge"
import {
  getProjectEntities,
  getProjectEntity,
  getProjectEntityAuthorityHistory,
  getProjectEntityMentions,
  getProjects,
} from "@/lib/api"
import {
  formatDate,
  formatPercentScore,
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
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
          Create a project first in Django admin.
        </div>
      </AppShell>
    )
  }

  const entityId = Number.parseInt(id, 10)
  const [entity, mentions, authorityHistory, projectEntities] = await Promise.all([
    getProjectEntity(selectedProject.id, entityId),
    getProjectEntityMentions(selectedProject.id, entityId),
    getProjectEntityAuthorityHistory(selectedProject.id, entityId),
    getProjectEntities(selectedProject.id),
  ])
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)
  const siblingEntities = projectEntities.filter((candidate) => candidate.id !== entity.id)
  const latestSnapshot = authorityHistory[0] ?? null
  const trendPoints = buildAuthorityTrendPoints(authorityHistory)

  return (
    <AppShell
      title="Entity detail"
      description="Inspect authority inputs, identity links, and extracted mention history for a tracked entity."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      {errorMessage ? (
        <div className="rounded-panel bg-destructive/14 px-4 py-4 text-sm leading-6 text-destructive">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.9fr)]">
        <div className="space-y-4">
          <article className="space-y-5 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Tracked entity</p>
                <h2 className="m-0 font-display text-title-lg font-bold text-foreground">
                  {entity.name}
                </h2>
                <div className="flex flex-wrap gap-2 text-sm text-muted">
                  <span>Created {formatDate(entity.created_at)}</span>
                  <span>{entity.mention_count} mention{entity.mention_count === 1 ? "" : "s"}</span>
                  <span>Authority {formatPercentScore(entity.authority_score)}</span>
                </div>
              </div>
              <StatusBadge tone="neutral">{entity.type}</StatusBadge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-border/10 bg-muted/45 p-4">
                <h3 className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                  Description
                </h3>
                <p className="m-0 text-sm leading-7 text-foreground">
                  {entity.description || "No description is set for this entity yet."}
                </p>
              </div>
              <div className="space-y-3 rounded-2xl border border-border/10 bg-muted/45 p-4">
                <h3 className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                  Identity links
                </h3>
                <ul className="m-0 grid list-none gap-2 p-0 text-sm text-muted">
                  {entity.website_url ? (
                    <li>
                      <a className="text-foreground transition hover:text-primary" href={entity.website_url} target="_blank">
                        Website
                      </a>
                    </li>
                  ) : null}
                  {entity.github_url ? (
                    <li>
                      <a className="text-foreground transition hover:text-primary" href={entity.github_url} target="_blank">
                        GitHub
                      </a>
                    </li>
                  ) : null}
                  {entity.linkedin_url ? (
                    <li>
                      <a className="text-foreground transition hover:text-primary" href={entity.linkedin_url} target="_blank">
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

          <article className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Authority view</p>
                <h3 className="m-0 font-display text-title-sm font-bold text-foreground">
                  Current score and history
                </h3>
              </div>
              <span className="text-sm text-muted">
                {authorityHistory.length} snapshot{authorityHistory.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)]">
              <div className="space-y-4 rounded-2xl border border-border/10 bg-muted/45 p-4">
                <div className="space-y-1">
                  <p className="m-0 text-sm uppercase tracking-[0.18em] text-muted">Authority score</p>
                  <p className="m-0 font-display text-4xl font-bold text-foreground">
                    {formatPercentScore(entity.authority_score)}
                  </p>
                  <p className="m-0 text-sm leading-6 text-muted">
                    This reflects the latest blend of mention frequency, editorial feedback, duplicate corroboration, and carry-forward history.
                  </p>
                </div>
                {authorityHistory.length > 1 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-muted">
                      <span>Recent trend</span>
                      <span>Latest {formatDate(authorityHistory[0]?.computed_at ?? null)}</span>
                    </div>
                    <svg
                      aria-label="Authority score trend"
                      className="h-20 w-full overflow-visible"
                      viewBox="0 0 220 72"
                      role="img"
                    >
                      <polyline
                        fill="none"
                        points={trendPoints}
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                      />
                    </svg>
                  </div>
                ) : (
                  <p className="m-0 text-sm leading-6 text-muted">
                    More recomputations will draw the trend line here.
                  </p>
                )}
              </div>

              <div className="space-y-4 rounded-2xl border border-border/10 bg-muted/45 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                    Latest components
                  </h4>
                  {latestSnapshot ? (
                    <span className="text-sm text-muted">
                      Updated {formatDate(latestSnapshot.computed_at)}
                    </span>
                  ) : null}
                </div>
                {latestSnapshot ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <AuthorityComponentCard label="Mention frequency" value={latestSnapshot.mention_component} />
                    <AuthorityComponentCard label="Feedback" value={latestSnapshot.feedback_component} />
                    <AuthorityComponentCard label="Duplicate signal" value={latestSnapshot.duplicate_component} />
                    <AuthorityComponentCard label="Carry-forward" value={latestSnapshot.decayed_prior} />
                  </div>
                ) : (
                  <p className="m-0 text-sm leading-6 text-muted">
                    Authority history has not been recomputed for this entity yet.
                  </p>
                )}
              </div>
            </div>

            {authorityHistory.length > 0 ? (
              <ul className="m-0 grid list-none gap-3 p-0">
                {authorityHistory.slice(0, 5).map((snapshot) => (
                  <li key={snapshot.id} className="rounded-2xl border border-border/10 bg-muted/45 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="flex flex-wrap gap-2 text-sm text-muted">
                        <span>{formatDate(snapshot.computed_at)}</span>
                        <span>Final {formatPercentScore(snapshot.final_score)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm text-muted">
                        <span>M {formatPercentScore(snapshot.mention_component)}</span>
                        <span>F {formatPercentScore(snapshot.feedback_component)}</span>
                        <span>D {formatPercentScore(snapshot.duplicate_component)}</span>
                        <span>Carry {formatPercentScore(snapshot.decayed_prior)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>

          <article className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Mention history</p>
                <h3 className="m-0 font-display text-title-sm font-bold text-foreground">
                  Extracted mentions linked to this entity
                </h3>
              </div>
              <span className="text-sm text-muted">{mentions.length} total mention{mentions.length === 1 ? "" : "s"}</span>
            </div>
            {mentions.length === 0 ? (
              <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
                No extracted mentions exist for this entity yet.
              </div>
            ) : (
              <ul className="m-0 grid list-none gap-3 p-0">
                {mentions.map((mention) => (
                  <li key={mention.id} className="rounded-2xl border border-border/10 bg-muted/45 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <Link
                          className="font-medium text-foreground transition hover:text-primary"
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
                        <span className="inline-flex items-center rounded-full border border-border/12 bg-card px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-muted">
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
          <article className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Navigation</p>
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105"
                href={`/entities?project=${selectedProject.id}`}
              >
                Back to entities
              </Link>
            </div>
          </article>

          <article className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
            <div>
              <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Related entities</p>
              <h3 className="m-0 font-display text-title-sm font-bold text-foreground">
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
                  <li key={siblingEntity.id} className="rounded-2xl border border-border/10 bg-muted/45 p-4">
                    <Link
                      className="font-medium text-foreground transition hover:text-primary"
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

function buildAuthorityTrendPoints(
  authorityHistory: Awaited<ReturnType<typeof getProjectEntityAuthorityHistory>>,
) {
  if (authorityHistory.length <= 1) {
    return "0,36 220,36"
  }

  const points = authorityHistory
    .slice()
    .reverse()
    .map((snapshot, index, snapshots) => {
      const x = (index / (snapshots.length - 1)) * 220
      const y = 72 - snapshot.final_score * 72
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })

  return points.join(" ")
}

function AuthorityComponentCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-border/10 bg-card/80 p-4">
      <p className="m-0 text-sm uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 mb-0 text-2xl font-bold text-foreground">{formatPercentScore(value)}</p>
    </div>
  )
}
