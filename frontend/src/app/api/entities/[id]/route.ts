import { NextResponse } from "next/server"

import { deleteEntity, updateEntity } from "@/lib/api"

/**
 * Build a redirect target for the entity form handlers.
 *
 * The route uses this helper to send users back to the entities screen while adding
 * a single success or error flash message to the query string. Relative paths are
 * resolved against the current request URL.
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
 * Handle entity form submissions for update and delete actions.
 *
 * The page layer posts `FormData` here so it can reuse the shared API helpers without
 * exposing backend credentials to the browser. The handler reads the dynamic entity id,
 * routes `intent=delete` to the delete helper, otherwise updates the entity, and then
 * redirects back to the requested UI location with a success or error flash message.
 * Missing form fields are normalized to empty strings to preserve the current backend
 * serializer contract.
 *
 * @param request - Incoming form submission request.
 * @param context - Route params containing the entity id.
 * @returns A redirect response pointing back to the entities UI.
 * @example
 * ```ts
 * const response = await POST(request, {
 *   params: Promise.resolve({ id: "9" }),
 * })
 * ```
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || "/entities")

  try {
    const projectId = Number.parseInt(
      String(formData.get("projectId") || "0"),
      10,
    )
    const entityId = Number.parseInt(id, 10)
    const intent = String(formData.get("intent") || "update")

    if (intent === "delete") {
      await deleteEntity(entityId, projectId)
      return NextResponse.redirect(
        buildRedirectUrl(request, redirectTo, { message: "Entity deleted." }),
      )
    }

    await updateEntity(entityId, projectId, {
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
      buildRedirectUrl(request, redirectTo, { message: "Entity updated." }),
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save entity."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
