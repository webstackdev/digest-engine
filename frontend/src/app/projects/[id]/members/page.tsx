import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { CopyButton } from "@/components/copy-button"
import {
  getProjectInvitations,
  getProjectMemberships,
  getProjects,
} from "@/lib/api"
import {
  formatDate,
  getErrorMessage,
  getSuccessMessage,
} from "@/lib/view-helpers"

type MembersPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the project membership-management page for one selected project.
 *
 * @param props - Async server component props.
 * @param props.params - Route params containing the project id.
 * @param props.searchParams - Search params promise containing optional flash-message values.
 * @returns The members management page or an access guard state.
 */
export default async function MembersPage({ params, searchParams }: MembersPageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams])
  const projectId = Number.parseInt(id, 10)
  const projects = await getProjects()
  const selectedProject = projects.find((project) => project.id === projectId) ?? null
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Members"
        description="That project is not available for the current API user."
        projects={projects}
        selectedProjectId={null}
      >
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
          Select a visible project first.
        </div>
      </AppShell>
    )
  }

  if (selectedProject.user_role !== "admin") {
    return (
      <AppShell
        title="Members"
        description="Only project admins can manage roster and invitation settings."
        projects={projects}
        selectedProjectId={selectedProject.id}
      >
        <div className="rounded-panel bg-destructive/14 px-4 py-4 text-sm leading-6 text-destructive">
          You need the admin role on this project to manage members.
        </div>
      </AppShell>
    )
  }

  const [memberships, invitations] = await Promise.all([
    getProjectMemberships(selectedProject.id),
    getProjectInvitations(selectedProject.id),
  ])
  const redirectTarget = `/projects/${selectedProject.id}/members?project=${selectedProject.id}`

  return (
    <AppShell
      title="Members"
      description="Manage project roles, review pending invitations, and keep admin coverage intact."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      {errorMessage ? (
        <div className="rounded-panel bg-destructive/14 px-4 py-4 text-sm leading-6 text-destructive">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <div>
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Roster</p>
            <h2 className="m-0 font-display text-title-sm font-bold text-foreground">
              {selectedProject.name} members
            </h2>
          </div>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105"
            href={`/projects/${selectedProject.id}/members/invite?project=${selectedProject.id}`}
          >
            Invite member
          </Link>
        </div>

        <article className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <div className="space-y-1">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Current team</p>
            <h3 className="m-0 font-display text-title-sm font-bold text-foreground">Memberships</h3>
          </div>
          <div className="space-y-3">
            {memberships.map((membership) => (
              <article
                className="grid gap-4 rounded-2xl border border-border/10 bg-muted/45 p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center"
                key={membership.id}
              >
                <div>
                  <p className="m-0 text-sm font-semibold text-foreground">
                    {membership.display_name || membership.username}
                  </p>
                  <p className="m-0 text-sm text-muted">{membership.email}</p>
                  <p className="mt-2 mb-0 text-xs uppercase tracking-eyebrow text-muted">
                    Joined {formatDate(membership.joined_at)}
                  </p>
                </div>
                <form action={`/api/projects/${selectedProject.id}/members/${membership.id}`} className="flex flex-wrap items-center gap-3" method="POST">
                  <input type="hidden" name="redirectTo" value={redirectTarget} />
                  <input type="hidden" name="intent" value="update-role" />
                  <select
                    aria-label={`Role for ${membership.display_name || membership.username}`}
                    className="rounded-2xl border border-border/12 bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                    defaultValue={membership.role}
                    name="role"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="reader">Reader</option>
                  </select>
                  <button
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/65"
                    type="submit"
                  >
                    Update role
                  </button>
                </form>
                <form action={`/api/projects/${selectedProject.id}/members/${membership.id}`} method="POST">
                  <input type="hidden" name="redirectTo" value={redirectTarget} />
                  <input type="hidden" name="intent" value="remove" />
                  <button
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive transition hover:bg-destructive/16"
                    type="submit"
                  >
                    Remove
                  </button>
                </form>
              </article>
            ))}
          </div>
        </article>

        <article className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <div className="space-y-1">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Pending access</p>
            <h3 className="m-0 font-display text-title-sm font-bold text-foreground">Invitations</h3>
          </div>
          {invitations.length === 0 ? (
            <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
              No active or historical invitations yet.
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <article
                  className="grid gap-4 rounded-2xl border border-border/10 bg-muted/45 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                  key={invitation.id}
                >
                  <div className="space-y-2">
                    <div>
                      <p className="m-0 text-sm font-semibold text-foreground">{invitation.email}</p>
                      <p className="m-0 text-sm text-muted">
                        {invitation.role} • Invited by {invitation.invited_by_email || "system"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-eyebrow text-muted">
                      <span>Created {formatDate(invitation.created_at)}</span>
                      {invitation.accepted_at ? <span>Accepted {formatDate(invitation.accepted_at)}</span> : null}
                      {invitation.revoked_at ? <span>Revoked {formatDate(invitation.revoked_at)}</span> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <a className="text-sm font-medium text-primary hover:text-primary" href={invitation.invite_url}>
                        {invitation.invite_url}
                      </a>
                      <CopyButton label="Copy invite link" value={invitation.invite_url} />
                    </div>
                  </div>
                  {invitation.revoked_at || invitation.accepted_at ? null : (
                    <form action={`/api/projects/${selectedProject.id}/invitations/${invitation.id}/revoke`} method="POST">
                      <input type="hidden" name="redirectTo" value={redirectTarget} />
                      <button
                        className="inline-flex min-h-11 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive transition hover:bg-destructive/16"
                        type="submit"
                      >
                        Revoke
                      </button>
                    </form>
                  )}
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </AppShell>
  )
}
