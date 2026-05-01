import Link from "next/link"

import { AppShell } from "@/components/layout/AppShell"
import { getProjects } from "@/lib/api"
import { getErrorMessage, getSuccessMessage } from "@/lib/view-helpers"

type InviteMemberPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the invitation composer for one project roster.
 *
 * @param props - Async server component props.
 * @param props.params - Route params containing the project id.
 * @param props.searchParams - Search params promise containing optional flash-message values.
 * @returns The invite composer or an access guard state.
 */
export default async function InviteMemberPage({ params, searchParams }: InviteMemberPageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams])
  const projectId = Number.parseInt(id, 10)
  const projects = await getProjects()
  const selectedProject = projects.find((project) => project.id === projectId) ?? null
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Invite member"
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
        title="Invite member"
        description="Only project admins can invite new members."
        projects={projects}
        selectedProjectId={selectedProject.id}
      >
        <div className="rounded-panel bg-destructive/14 px-4 py-4 text-sm leading-6 text-destructive">
          You need the admin role on this project to invite new members.
        </div>
      </AppShell>
    )
  }

  const redirectTarget = `/projects/${selectedProject.id}/members/invite?project=${selectedProject.id}`

  return (
    <AppShell
      title="Invite member"
      description="Send a one-time invitation link that grants project access with a predefined role."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      {errorMessage ? (
        <div className="rounded-panel bg-destructive/14 px-4 py-4 text-sm leading-6 text-destructive">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
      ) : null}

      <article className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
        <div className="space-y-1">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Access</p>
          <h2 className="m-0 font-display text-title-sm font-bold text-foreground">
            Invite a new member
          </h2>
        </div>

        <form action={`/api/projects/${selectedProject.id}/invitations`} className="space-y-4" method="POST">
          <input type="hidden" name="redirectTo" value={redirectTarget} />
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Email</span>
            <input
              className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              name="email"
              required
              type="email"
            />
          </label>
          <label className="grid gap-2 sm:max-w-xs">
            <span className="text-sm font-medium text-foreground">Role</span>
            <select
              className="rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              defaultValue="member"
              name="role"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="reader">Reader</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105"
              type="submit"
            >
              Send invitation
            </button>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50"
              href={`/projects/${selectedProject.id}/members?project=${selectedProject.id}`}
            >
              Back to members
            </Link>
          </div>
        </form>
      </article>
    </AppShell>
  )
}
