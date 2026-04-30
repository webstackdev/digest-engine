import { NextResponse } from "next/server"

import { revokeProjectInvitation } from "@/lib/api"

function buildRedirectUrl(
  request: Request,
  redirectTo: string,
  params: Record<string, string>,
) {
  const url = new URL(redirectTo || "/", request.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

/**
 * Handle invitation revocation for one project.
 *
 * @param request - Incoming form submission request.
 * @param context - Route params containing the project and invitation ids.
 * @returns A redirect response back to the members page.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; invitationId: string }> },
) {
  const { id, invitationId } = await context.params
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || `/projects/${id}/members`)

  try {
    await revokeProjectInvitation(
      Number.parseInt(id, 10),
      Number.parseInt(invitationId, 10),
    )
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { message: "Invitation revoked." }),
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to revoke invitation."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
