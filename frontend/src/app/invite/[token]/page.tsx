import Link from "next/link"
import { getServerSession } from "next-auth"

import { getMembershipInvitation } from "@/lib/api"
import { authOptions } from "@/lib/auth"
import { getErrorMessage, getSuccessMessage } from "@/lib/view-helpers"

type InvitePageProps = {
  params: Promise<{ token: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the invitation acceptance page for one token.
 *
 * @param props - Async server component props.
 * @param props.params - Route params containing the invitation token.
 * @param props.searchParams - Search params promise containing optional flash-message values.
 * @returns The invitation acceptance page.
 */
export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const [{ token }, resolvedSearchParams] = await Promise.all([params, searchParams])
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)
  const session = await getServerSession(authOptions)

  let invitationError = ""
  let invitation = null

  try {
    invitation = await getMembershipInvitation(token)
  } catch (error) {
    invitationError = error instanceof Error ? error.message : "Unable to load invitation."
  }

  const callbackUrl = `/invite/${token}`

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-2xl space-y-6 rounded-3xl border border-ink/12 bg-surface/90 p-8 shadow-panel backdrop-blur-xl">
        <div>
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow text-muted">
            Newsletter Maker
          </p>
          <h1 className="mt-2 font-display text-display-page font-bold text-ink">
            Project invitation
          </h1>
        </div>

        {errorMessage ? (
          <div className="rounded-panel bg-danger/14 px-4 py-4 text-sm leading-6 text-danger-ink">{errorMessage}</div>
        ) : null}
        {successMessage ? (
          <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
        ) : null}
        {invitationError ? (
          <div className="rounded-panel bg-danger/14 px-4 py-4 text-sm leading-6 text-danger-ink">{invitationError}</div>
        ) : null}

        {invitation ? (
          <article className="space-y-4 rounded-3xl border border-ink/12 bg-surface-strong/45 p-5">
            <div>
              <p className="m-0 text-sm text-muted">Project</p>
              <h2 className="m-0 font-display text-title-sm font-bold text-ink">
                {invitation.project_name}
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="m-0 text-sm text-muted">Invited email</p>
                <p className="m-0 text-sm font-medium text-ink">{invitation.email}</p>
              </div>
              <div>
                <p className="m-0 text-sm text-muted">Role</p>
                <p className="m-0 text-sm font-medium text-ink">{invitation.role}</p>
              </div>
            </div>

            {invitation.status === "revoked" ? (
              <div className="rounded-panel bg-danger/14 px-4 py-4 text-sm leading-6 text-danger-ink">
                This invitation has been revoked.
              </div>
            ) : invitation.status === "accepted" ? (
              <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
                This invitation has already been accepted.
              </div>
            ) : session?.user ? (
              <form action={`/api/invitations/${token}/accept`} method="POST">
                <input type="hidden" name="redirectTo" value={callbackUrl} />
                <button
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105"
                  type="submit"
                >
                  Accept invitation
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                <p className="m-0 text-sm leading-6 text-muted">
                  Sign in as {invitation.email} to accept this invitation.
                </p>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105"
                  href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                >
                  Sign in to continue
                </Link>
              </div>
            )}
          </article>
        ) : null}
      </div>
    </div>
  )
}
