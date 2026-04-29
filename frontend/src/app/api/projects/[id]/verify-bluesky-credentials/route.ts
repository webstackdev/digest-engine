import { NextResponse } from "next/server"

import { verifyProjectBlueskyCredentials } from "@/lib/api"

/**
 * Build a redirect target for the Bluesky verification form handler.
 *
 * @param request - Incoming request used as the base URL for relative redirects.
 * @param redirectTo - Caller-provided redirect target, or a fallback path.
 * @param params - Query params to append to the redirect target.
 * @returns A redirect URL with the provided flash-message params.
 */
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
 * Handle Bluesky credential verification requests for one project.
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
    const result = await verifyProjectBlueskyCredentials(projectId)
    const message = result.handle
      ? `Verified Bluesky account ${result.handle}.`
      : "Bluesky credentials verified."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { message }),
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to verify Bluesky credentials."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
