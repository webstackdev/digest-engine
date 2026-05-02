import { NextResponse } from "next/server"

import { verifyProjectLinkedInCredentials } from "@/lib/api"

function buildRedirectUrl(
  request: Request,
  redirectTo: string,
  params: Record<string, string>,
) {
  const url = new URL(redirectTo || "/admin/sources", request.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

/**
 * Handle LinkedIn credential verification requests for one project.
 *
 * @param request - Incoming form submission request.
 * @param context - Route params containing the project id.
 * @returns A redirect response pointing back to the source settings UI.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || "/admin/sources")

  try {
    const projectId = Number.parseInt(id, 10)
    const result = await verifyProjectLinkedInCredentials(projectId)
    const message = result.member_urn
      ? `Verified LinkedIn member ${result.member_urn}.`
      : "LinkedIn credentials verified."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { message }),
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to verify LinkedIn credentials."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
