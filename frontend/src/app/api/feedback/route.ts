import { NextResponse } from "next/server"

import { createFeedback } from "@/lib/api"

/**
 * Build a redirect target for the feedback form handler.
 *
 * The route uses this helper to return users to the current UI with a single flash
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
  const url = new URL(redirectTo || "/", request.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

/**
 * Handle feedback form submissions for a content item.
 *
 * The UI posts `FormData` here so it can reuse the shared backend API helper while
 * keeping backend credentials server-side. On success the handler redirects back to
 * the requested UI location with a `Feedback saved.` flash message. Failures are
 * converted into redirect query params so the page can render inline feedback after
 * navigation completes.
 *
 * @param request - Incoming form submission request.
 * @returns A redirect response pointing back to the requested UI location.
 * @example
 * ```ts
 * const response = await POST(request)
 * ```
 */
export async function POST(request: Request) {
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || "/")

  try {
    const projectId = Number.parseInt(
      String(formData.get("projectId") || "0"),
      10,
    )
    const contentId = Number.parseInt(
      String(formData.get("contentId") || "0"),
      10,
    )
    const feedbackType = String(formData.get("feedbackType") || "upvote") as
      | "upvote"
      | "downvote"
    await createFeedback(projectId, contentId, feedbackType)
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { message: "Feedback saved." }),
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save feedback."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
