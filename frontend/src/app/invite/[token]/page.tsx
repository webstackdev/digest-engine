import { getServerSession } from "next-auth"

import { InvitePageContent } from "@/app/invite/[token]/_components/InvitePageContent"
import { getMembershipInvitation } from "@/lib/api"
import { authOptions } from "@/lib/auth"
import { getErrorMessage, getSuccessMessage } from "@/lib/view-helpers"

type InvitePageProps = {
  /** Route params promise containing the invitation token. */
  params: Promise<{ token: string }>
  /** Search params promise containing optional flash-message values. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the invitation acceptance page for one token.
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

  return (
    <InvitePageContent
      errorMessage={errorMessage}
      invitation={invitation}
      invitationError={invitationError}
      isAuthenticated={Boolean(session?.user)}
      successMessage={successMessage}
      token={token}
    />
  )
}
