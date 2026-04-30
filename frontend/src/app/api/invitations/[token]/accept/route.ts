import { NextResponse } from "next/server"

import { acceptMembershipInvitation } from "@/lib/api"

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
 * Accept one invitation token and redirect into the invited project.
 *
 * @param request - Incoming form submission request.
 * @param context - Route params containing the invitation token.
 * @returns A redirect response to the invited project dashboard or back to the invite page.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || `/invite/${token}`)

  try {
    const invitation = await acceptMembershipInvitation(token)
    return NextResponse.redirect(
      buildRedirectUrl(
        request,
        `/?project=${invitation.project_id}`,
        { message: `Joined ${invitation.project_name}.` },
      ),
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to accept invitation."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
