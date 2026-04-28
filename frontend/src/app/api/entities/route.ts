import { NextResponse } from "next/server"

import { createEntity } from "@/lib/api"

/**
 * Build a redirect target for the entity creation form handler.
 *
 * The route uses this helper to return users to the entities UI with a single flash
 * message encoded in the query string. Relative redirects are resolved against the
 * incoming request URL.
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
  const url = new URL(redirectTo || "/entities", request.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

/**
 * Handle entity creation form submissions.
 *
 * The entities page posts `FormData` here so creation can reuse the shared backend
 * API helper without exposing backend credentials to the browser. On success the
 * handler redirects back to the requested UI location with a success flash message.
 * Errors are converted into redirect query params so the page can render inline
 * feedback after the navigation completes.
 *
 * @param request - Incoming form submission request.
 * @returns A redirect response pointing back to the entities UI.
 * @example
 * ```ts
 * const response = await POST(request)
 * ```
 */
export async function POST(request: Request) {
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || "/entities")

  try {
    const projectId = Number.parseInt(
      String(formData.get("projectId") || "0"),
      10,
    )
    await createEntity(projectId, {
      name: String(formData.get("name") || ""),
      type: String(formData.get("type") || "vendor"),
      description: String(formData.get("description") || ""),
      website_url: String(formData.get("website_url") || ""),
      github_url: String(formData.get("github_url") || ""),
      linkedin_url: String(formData.get("linkedin_url") || ""),
      bluesky_handle: String(formData.get("bluesky_handle") || ""),
      mastodon_handle: String(formData.get("mastodon_handle") || ""),
      twitter_handle: String(formData.get("twitter_handle") || ""),
    })
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { message: "Entity created." }),
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create entity."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
