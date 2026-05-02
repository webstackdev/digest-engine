import { NextResponse } from "next/server"

import { startProjectLinkedInOAuth } from "@/lib/api"

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
 * Handle LinkedIn OAuth start requests for one project.
 *
 * @param request - Incoming form submission request.
 * @param context - Route params containing the project id.
 * @returns A redirect response to LinkedIn or back to the sources UI on failure.
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
    const result = await startProjectLinkedInOAuth(projectId, redirectTo)
    return NextResponse.redirect(result.authorize_url)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start LinkedIn authorization."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
