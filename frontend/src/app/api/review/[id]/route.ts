import { NextResponse } from "next/server"

import { updateReviewQueueItem } from "@/lib/api"

/**
 * Build a redirect target for the review-item form handler.
 *
 * The route uses this helper to send editors back to the current UI with a single
 * flash message encoded in the query string. Relative redirects are resolved against
 * the incoming request URL.
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
  const url = new URL(redirectTo || "/", request.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

/**
 * Handle review-queue form submissions for a single review item.
 *
 * The UI posts `FormData` here so moderation actions can reuse the shared backend API
 * helper while keeping backend credentials server-side. The handler reads the dynamic
 * review id, normalizes the `resolved` checkbox flag to a boolean, forwards the update,
 * and redirects back to the requested UI location with either a success or error flash
 * message.
 *
 * @param request - Incoming form submission request.
 * @param context - Route params containing the review item id.
 * @returns A redirect response pointing back to the requested UI location.
 * @example
 * ```ts
 * const response = await POST(request, {
 *   params: Promise.resolve({ id: "7" }),
 * })
 * ```
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || "/")

  try {
    const projectId = Number.parseInt(
      String(formData.get("projectId") || "0"),
      10,
    )
    const reviewId = Number.parseInt(id, 10)
    const resolved = String(formData.get("resolved") || "false") === "true"
    const resolution = String(formData.get("resolution") || "")
    await updateReviewQueueItem(reviewId, projectId, { resolved, resolution })
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, {
        message: "Review item updated.",
      }),
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update review item."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
