import { NextResponse } from "next/server"

import { runContentSkill } from "@/lib/api"
import type { ContentSkillName } from "@/lib/types"

/**
 * Check whether a skill result is still executing asynchronously.
 *
 * Pending and running results are treated the same by the route layer: both return a
 * queued-style message and a `202` JSON status when `mode=json` is requested.
 *
 * @param status - Skill result status returned by the backend.
 * @returns `true` when the skill is still pending or running.
 */
function isAsyncSkillStatus(status: string) {
  return status === "pending" || status === "running"
}

/**
 * Build a redirect target for skill-action form submissions.
 *
 * The route uses this helper to send users back to the current UI with a single
 * success or error flash message in the query string when JSON mode is not requested.
 * Relative redirects are resolved against the incoming request URL.
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
 * Handle ad hoc content-skill requests for the current content item.
 *
 * The content page posts `FormData` here so the frontend can reuse the shared backend
 * API helper while keeping backend credentials server-side. The handler supports two
 * response modes: `mode=json` for button-driven async flows that need structured status
 * information, and redirect mode for classic form submissions that rely on flash
 * messages in the query string.
 *
 * @param request - Incoming form submission request.
 * @param context - Route params containing the skill name.
 * @returns A JSON response or redirect response, depending on the requested mode.
 * @example
 * ```ts
 * const response = await POST(request, {
 *   params: Promise.resolve({ skillName: "summarization" }),
 * })
 * ```
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ skillName: string }> },
) {
  const { skillName } = await context.params
  const responseMode = new URL(request.url).searchParams.get("mode")
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
    const result = await runContentSkill(
      projectId,
      contentId,
      skillName as ContentSkillName,
    )
    const message = isAsyncSkillStatus(result.status)
      ? `${skillName} queued.`
      : result.status === "failed"
        ? result.error_message || `${skillName} failed.`
        : `${skillName} completed.`

    if (responseMode === "json") {
      return NextResponse.json(
        {
          message,
          skillResult: result,
        },
        {
          status: isAsyncSkillStatus(result.status)
            ? 202
            : result.status === "failed"
              ? 400
              : 200,
        },
      )
    }

    if (result.status === "failed") {
      return NextResponse.redirect(
        buildRedirectUrl(request, redirectTo, {
          error: result.error_message || `${skillName} failed.`,
        }),
      )
    }
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, {
        message,
      }),
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Unable to run ${skillName}.`

    if (responseMode === "json") {
      return NextResponse.json({ message }, { status: 400 })
    }

    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
