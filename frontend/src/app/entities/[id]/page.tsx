import Link from "next/link"

import { AuthorityWeightControls } from "@/app/entities/[id]/_components/AuthorityWeightControls"
import { StatusBadge } from "@/components/elements/StatusBadge"
import { AppShell } from "@/components/layout/AppShell"
import {
  getProjectConfig,
  getProjectEntities,
  getProjectEntity,
  getProjectEntityAuthorityComponents,
  getProjectEntityAuthorityHistory,
  getProjectEntityMentions,
  getProjects,
} from "@/lib/api"
import type { EntityAuthoritySnapshot } from "@/lib/types"
import {
  formatDate,
  formatPercentScore,
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type EntityDetailPageProps = {
  /** Route params promise containing the entity id. */
  params: Promise<{ id: string }>
  /** Search params promise containing the optional `project`, `error`, and `message` values. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the detail view for one tracked entity in the selected project.
 *
 * The page joins the entity record with its current authority breakdown, historical
 * snapshots, and extracted mention history so editors can inspect how the pipeline is
 * linking content and weighting authority over time.
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
  const [
    entity,
    mentions,
    authorityComponents,
    authorityHistory,
    projectEntities,
    projectConfig,
  ] = await Promise.all([
    getProjectEntity(selectedProject.id, entityId),
    getProjectEntityMentions(selectedProject.id, entityId),
    getProjectEntityAuthorityComponents(selectedProject.id, entityId).catch(
      () => null,
    ),
    getProjectEntityAuthorityHistory(selectedProject.id, entityId),
    getProjectEntities(selectedProject.id),
    selectedProject.user_role === "admin"
      ? getProjectConfig(selectedProject.id)
      : Promise.resolve(null),
  ])
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)
  const siblingEntities = projectEntities.filter((candidate) => candidate.id !== entity.id)
  const latestSnapshot = authorityComponents ?? authorityHistory[0] ?? null
  const trendPoints = buildAuthorityTrendPoints(authorityHistory)
  const componentMix = latestSnapshot ? buildAuthorityComponentMix(latestSnapshot) : []
  const carryForwardWeight = latestSnapshot ? Math.max(0, latestSnapshot.decayed_prior) : 0

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
                    This reflects the latest blend of mention frequency, engagement, recency, source quality, cross-newsletter corroboration, editorial feedback, duplicate corroboration, and carry-forward history.
                  </p>
                </div>
                {latestSnapshot ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm text-muted">
                      <span>Current component mix</span>
                      <span>Carry-forward {formatPercentScore(carryForwardWeight)}</span>
                    </div>
                    <div
                      aria-label="Authority component mix"
                      className="overflow-hidden rounded-full border border-border/10 bg-card/80"
                      role="img"
                    >
                      <svg className="block h-4 w-full" viewBox="0 0 100 8" preserveAspectRatio="none">
                        {componentMix.map((component) => (
                          <rect
                            className={component.className}
                            height="8"
                            key={component.label}
                            rx="0"
                            ry="0"
                            width={component.width}
                            x={component.offset}
                            y="0"
                          >
                            <title>{`${component.label} ${formatPercentScore(component.value)}`}</title>
                          </rect>
                        ))}
                      </svg>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {componentMix.map((component) => (
                        <div className="flex items-center gap-2 text-sm text-muted" key={component.label}>
                          <span className={`h-3 w-3 rounded-full ${component.className}`} />
                          <span>{component.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
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
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <AuthorityComponentCard label="Mention frequency" value={latestSnapshot.mention_component} />
                    <AuthorityComponentCard label="Engagement" value={latestSnapshot.engagement_component} />
                    <AuthorityComponentCard label="Recency" value={latestSnapshot.recency_component} />
                    <AuthorityComponentCard label="Source quality" value={latestSnapshot.source_quality_component} />
                    <AuthorityComponentCard label="Cross-newsletter" value={latestSnapshot.cross_newsletter_component} />
                    <AuthorityComponentCard label="Feedback" value={latestSnapshot.feedback_component} />
                    <AuthorityComponentCard label="Duplicate signal" value={latestSnapshot.duplicate_component} />
                    <AuthorityComponentCard label="Carry-forward" value={latestSnapshot.decayed_prior} />
                  </div>
                ) : (
                  <p className="m-0 text-sm leading-6 text-muted">
                    Authority history has not been recomputed for this entity yet.
                  </p>
                )}
                {latestSnapshot?.weights_at_compute ? (
                  <div className="space-y-2">
                    <h5 className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                      Weights at compute
                    </h5>
                    <div className="flex flex-wrap gap-2 text-sm text-muted">
                      {Object.entries(latestSnapshot.weights_at_compute).map(([key, value]) => (
                        <span className="inline-flex items-center rounded-full border border-border/12 bg-card px-3 py-1 text-sm text-foreground" key={key}>
                          {formatWeightLabel(key)} {formatPercentScore(value)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedProject.user_role === "admin" ? (
                  <AuthorityWeightControls
                    projectConfig={projectConfig}
                    projectId={selectedProject.id}
                    redirectTo={`/entities/${entity.id}?project=${selectedProject.id}`}
                  />
                ) : null}
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
                        <span>E {formatPercentScore(snapshot.engagement_component)}</span>
                        <span>R {formatPercentScore(snapshot.recency_component)}</span>
                        <span>SQ {formatPercentScore(snapshot.source_quality_component)}</span>
                        <span>CN {formatPercentScore(snapshot.cross_newsletter_component)}</span>
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

function buildAuthorityComponentMix(snapshot: EntityAuthoritySnapshot) {
  const components = [
    {
      label: "Mention frequency",
      value: Math.max(0, snapshot.mention_component),
      className: "bg-primary",
    },
    {
      label: "Engagement",
      value: Math.max(0, snapshot.engagement_component),
      className: "bg-emerald-500",
    },
    {
      label: "Recency",
      value: Math.max(0, snapshot.recency_component),
      className: "bg-cyan-500",
    },
    {
      label: "Source quality",
      value: Math.max(0, snapshot.source_quality_component),
      className: "bg-amber-500",
    },
    {
      label: "Cross-newsletter",
      value: Math.max(0, snapshot.cross_newsletter_component),
      className: "bg-fuchsia-500",
    },
    {
      label: "Feedback",
      value: Math.max(0, snapshot.feedback_component),
      className: "bg-sky-500",
    },
    {
      label: "Duplicate signal",
      value: Math.max(0, snapshot.duplicate_component),
      className: "bg-rose-500",
    },
  ]
  const total = components.reduce((sum, component) => sum + component.value, 0)
  let offset = 0

  return components.map((component) => {
    const share = total > 0 ? component.value / total : 1 / components.length
    const mappedComponent = {
      ...component,
      share,
      offset,
      width: share * 100,
    }
    offset += mappedComponent.width
    return mappedComponent
  })
}

function formatWeightLabel(label: string) {
  return label.replaceAll("_", " ")
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
