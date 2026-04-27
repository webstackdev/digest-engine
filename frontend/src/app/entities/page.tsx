import { AppShell } from "@/components/app-shell"
import { StatusBadge } from "@/components/status-badge"
import { getProjectEntities, getProjects } from "@/lib/api"
import {
  formatDate,
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type EntitiesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

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
        <div className="rounded-[18px] bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
          Create a project first in Django admin.
        </div>
      </AppShell>
    )
  }

  const entities = await getProjectEntities(selectedProject.id)
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
        <div className="rounded-[18px] bg-danger/14 px-4 py-4 text-sm leading-6 text-danger-ink">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-[18px] bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.95fr)]">
        <article className="space-y-4 rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
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
                <span className="text-sm font-medium text-ink">Name</span>
                <input className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15" name="name" required />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">Type</span>
                <select
                  className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
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
              <span className="text-sm font-medium text-ink">Description</span>
              <textarea
                className="min-h-[120px] w-full resize-y rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                name="description"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">Website URL</span>
                <input className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15" name="website_url" type="url" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">GitHub URL</span>
                <input className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15" name="github_url" type="url" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">LinkedIn URL</span>
                <input className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15" name="linkedin_url" type="url" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">Bluesky handle</span>
                <input className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15" name="bluesky_handle" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">Mastodon handle</span>
                <input className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15" name="mastodon_handle" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">Twitter handle</span>
                <input className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15" name="twitter_handle" />
              </label>
            </div>
            <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
              Create entity
            </button>
          </form>
        </article>

        <div className="space-y-4">
          {entities.length === 0 ? (
            <div className="rounded-[18px] bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
              No entities exist for this project yet.
            </div>
          ) : null}
          {entities.map((entity) => (
            <article key={entity.id} className="space-y-4 rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-display text-title-md font-bold">
                    {entity.name}
                  </h3>
                  <div className="flex flex-wrap gap-2 text-sm text-muted">
                    <span>{formatDate(entity.created_at)}</span>
                    <span>Authority {entity.authority_score.toFixed(2)}</span>
                  </div>
                </div>
                <StatusBadge tone="neutral">{entity.type}</StatusBadge>
              </div>
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
                    <span className="text-sm font-medium text-ink">Name</span>
                    <input
                      className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="name"
                      defaultValue={entity.name}
                      required
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-ink">Type</span>
                    <select
                      className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
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
                  <span className="text-sm font-medium text-ink">Description</span>
                  <textarea
                    className="min-h-[120px] w-full resize-y rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                    name="description"
                    defaultValue={entity.description}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-ink">Website URL</span>
                    <input
                      className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="website_url"
                      type="url"
                      defaultValue={entity.website_url}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-ink">GitHub URL</span>
                    <input
                      className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="github_url"
                      type="url"
                      defaultValue={entity.github_url}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-ink">LinkedIn URL</span>
                    <input
                      className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="linkedin_url"
                      type="url"
                      defaultValue={entity.linkedin_url}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-ink">Bluesky handle</span>
                    <input
                      className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="bluesky_handle"
                      defaultValue={entity.bluesky_handle}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-ink">Mastodon handle</span>
                    <input
                      className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="mastodon_handle"
                      defaultValue={entity.mastodon_handle}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-ink">Twitter handle</span>
                    <input
                      className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="twitter_handle"
                      defaultValue={entity.twitter_handle}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
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
                <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-danger to-danger-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105" type="submit">
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
