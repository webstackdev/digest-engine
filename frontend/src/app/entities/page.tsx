import Link from "next/link"

import { StatusBadge } from "@/components/elements/StatusBadge"
import { AppShell } from "@/components/layout/AppShell"
import {
  getProjectEntities,
  getProjectEntityCandidates,
  getProjects,
} from "@/lib/api"
import {
  formatDate,
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type EntitiesPageProps = {
  /** Search params promise containing the optional `project`, `error`, and `message` values. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the entity management page for the selected project.
 *
 * This page resolves the active project from the URL, loads the project-scoped entity
 * list, and renders both the create form and update/delete controls for existing entities.
 * When no project is available for the configured API user, it returns a guarded empty
 * state instead of issuing any project-scoped entity requests.
 */
export default async function EntitiesPage({
  searchParams,
}: EntitiesPageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Entities"
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

  const entities = await getProjectEntities(selectedProject.id)
  const entityCandidates = await getProjectEntityCandidates(selectedProject.id)
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)

  return (
    <AppShell
      title="Entity management"
      description="Create, update, and remove the people and organizations that anchor relevance for this project."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      {errorMessage ? (
        <div className="rounded-panel bg-destructive/14 px-4 py-4 text-sm leading-6 text-destructive">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.65fr)]">
        <div className="space-y-4">
          <article className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Create entity</p>
            <form className="space-y-4" action="/api/entities" method="POST">
              <input type="hidden" name="projectId" value={selectedProject.id} />
              <input
                type="hidden"
                name="redirectTo"
                value={`/entities?project=${selectedProject.id}`}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Name</span>
                  <input className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15" name="name" required />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Type</span>
                  <select
                    className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                    name="type"
                    defaultValue="vendor"
                  >
                    <option value="individual">Individual</option>
                    <option value="vendor">Vendor</option>
                    <option value="organization">Organization</option>
                  </select>
                </label>
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Description</span>
                <textarea
                  className="min-h-30 w-full resize-y rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  name="description"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Website URL</span>
                  <input className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15" name="website_url" type="url" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">GitHub URL</span>
                  <input className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15" name="github_url" type="url" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">LinkedIn URL</span>
                  <input className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15" name="linkedin_url" type="url" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Bluesky handle</span>
                  <input className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15" name="bluesky_handle" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Mastodon handle</span>
                  <input className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15" name="mastodon_handle" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Twitter handle</span>
                  <input className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15" name="twitter_handle" />
                </label>
              </div>
              <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                Create entity
              </button>
            </form>
          </article>

          <article className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
            <div className="space-y-1">
              <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Candidate queue</p>
              <h2 className="m-0 font-display text-title-sm font-bold text-foreground">
                Pending entity candidates
              </h2>
            </div>
            {entityCandidates.length === 0 ? (
              <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
                No pending entity candidates right now.
              </div>
            ) : (
              <div className="space-y-3">
                {entityCandidates.map((candidate) => (
                  <article
                    key={candidate.id}
                    className="space-y-3 rounded-2xl border border-border/10 bg-muted/50 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="m-0 font-display text-lg font-bold text-foreground">
                          {candidate.name}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted">
                          <span>{candidate.suggested_type}</span>
                          <span>{candidate.occurrence_count} occurrence{candidate.occurrence_count === 1 ? "" : "s"}</span>
                          {candidate.first_seen_title ? (
                            <span>First seen in {candidate.first_seen_title}</span>
                          ) : null}
                        </div>
                      </div>
                      <StatusBadge tone="warning">{candidate.status}</StatusBadge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <form action={`/api/entity-candidates/${candidate.id}`} method="POST">
                        <input type="hidden" name="projectId" value={selectedProject.id} />
                        <input
                          type="hidden"
                          name="redirectTo"
                          value={`/entities?project=${selectedProject.id}`}
                        />
                        <input type="hidden" name="intent" value="accept" />
                        <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105" type="submit">
                          Accept
                        </button>
                      </form>
                      <form action={`/api/entity-candidates/${candidate.id}`} method="POST">
                        <input type="hidden" name="projectId" value={selectedProject.id} />
                        <input
                          type="hidden"
                          name="redirectTo"
                          value={`/entities?project=${selectedProject.id}`}
                        />
                        <input type="hidden" name="intent" value="reject" />
                        <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-destructive/25 bg-destructive/12 px-4 py-3 text-sm font-medium text-destructive transition hover:bg-destructive/16" type="submit">
                          Reject
                        </button>
                      </form>
                    </div>
                    <form
                      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                      action={`/api/entity-candidates/${candidate.id}`}
                      method="POST"
                    >
                      <input type="hidden" name="projectId" value={selectedProject.id} />
                      <input
                        type="hidden"
                        name="redirectTo"
                        value={`/entities?project=${selectedProject.id}`}
                      />
                      <input type="hidden" name="intent" value="merge" />
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-foreground">Merge into existing entity</span>
                        <select
                          className="w-full rounded-2xl border border-border/12 bg-card/80 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                          name="mergedInto"
                          defaultValue=""
                        >
                          <option value="">Select entity</option>
                          {entities.map((entity) => (
                            <option key={entity.id} value={entity.id}>
                              {entity.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className="inline-flex min-h-11 items-center justify-center self-end rounded-full border border-border/12 bg-card px-4 py-3 text-sm font-medium text-foreground transition hover:border-primary/30 hover:bg-muted/80" type="submit">
                        Merge
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>

        <div className="space-y-4">
          {entities.length === 0 ? (
            <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
              No entities exist for this project yet.
            </div>
          ) : null}
          {entities.map((entity) => (
            <article key={entity.id} className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-display text-title-md font-bold">
                    <Link
                      className="transition hover:text-primary"
                      href={`/entities/${entity.id}?project=${selectedProject.id}`}
                    >
                      {entity.name}
                    </Link>
                  </h3>
                  <div className="flex flex-wrap gap-2 text-sm text-muted">
                    <span>{formatDate(entity.created_at)}</span>
                    <span>Authority {entity.authority_score.toFixed(2)}</span>
                    <span>
                      {entity.mention_count} mention{entity.mention_count === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <StatusBadge tone="neutral">{entity.type}</StatusBadge>
              </div>
              <section className="space-y-3 rounded-2xl border border-border/10 bg-muted/45 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                    Recent mentions
                  </h4>
                  <span className="text-sm text-muted">
                    {entity.mention_count} total
                  </span>
                </div>
                {entity.latest_mentions.length === 0 ? (
                  <p className="m-0 text-sm leading-6 text-muted">
                    No extracted mentions for this entity yet.
                  </p>
                ) : (
                  <ul className="m-0 grid list-none gap-3 p-0">
                    {entity.latest_mentions.map((mention) => (
                      <li key={mention.id} className="rounded-2xl border border-border/10 bg-card/80 p-3">
                        <div className="flex flex-wrap gap-2 text-sm text-muted">
                          <span>{mention.content_title}</span>
                          <span>{mention.role}</span>
                          {mention.sentiment ? <span>{mention.sentiment}</span> : null}
                          <span>{Math.round(mention.confidence * 100)}% confidence</span>
                        </div>
                        {mention.span ? (
                          <p className="mb-0 mt-2 text-sm leading-6 text-foreground">
                            Matched span: {mention.span}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <form
                className="space-y-4"
                action={`/api/entities/${entity.id}`}
                method="POST"
              >
                <input
                  type="hidden"
                  name="projectId"
                  value={selectedProject.id}
                />
                <input
                  type="hidden"
                  name="redirectTo"
                  value={`/entities?project=${selectedProject.id}`}
                />
                <input type="hidden" name="intent" value="update" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">Name</span>
                    <input
                      className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="name"
                      defaultValue={entity.name}
                      required
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">Type</span>
                    <select
                      className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="type"
                      defaultValue={entity.type}
                    >
                      <option value="individual">Individual</option>
                      <option value="vendor">Vendor</option>
                      <option value="organization">Organization</option>
                    </select>
                  </label>
                </div>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Description</span>
                  <textarea
                    className="min-h-30 w-full resize-y rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                    name="description"
                    defaultValue={entity.description}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">Website URL</span>
                    <input
                      className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="website_url"
                      type="url"
                      defaultValue={entity.website_url}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">GitHub URL</span>
                    <input
                      className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="github_url"
                      type="url"
                      defaultValue={entity.github_url}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">LinkedIn URL</span>
                    <input
                      className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="linkedin_url"
                      type="url"
                      defaultValue={entity.linkedin_url}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">Bluesky handle</span>
                    <input
                      className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="bluesky_handle"
                      defaultValue={entity.bluesky_handle}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">Mastodon handle</span>
                    <input
                      className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="mastodon_handle"
                      defaultValue={entity.mastodon_handle}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">Twitter handle</span>
                    <input
                      className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="twitter_handle"
                      defaultValue={entity.twitter_handle}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                    Save changes
                  </button>
                </div>
              </form>
              <form action={`/api/entities/${entity.id}`} method="POST">
                <input
                  type="hidden"
                  name="projectId"
                  value={selectedProject.id}
                />
                <input
                  type="hidden"
                  name="redirectTo"
                  value={`/entities?project=${selectedProject.id}`}
                />
                <input type="hidden" name="intent" value="delete" />
                <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-destructive to-destructive px-4 py-3 text-sm font-medium text-destructive-foreground transition hover:brightness-105" type="submit">
                  Delete entity
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  )
}
