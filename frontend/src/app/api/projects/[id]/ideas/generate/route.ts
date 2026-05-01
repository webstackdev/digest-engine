import { NextResponse } from "next/server"

import {
  generateProjectOriginalContentIdeas,
  isCompletedOriginalContentIdeaGeneration,
} from "@/lib/api"

import { buildTrendRedirectUrl } from "../../trend-action-helpers"

/**
 * Handle manual original-content idea generation requests from the ideas queue.
 *
 * @param request - Incoming form submission request.
 * @param context - Route params containing the owning project id.
 * @returns A redirect response pointing back to the ideas page with a flash message.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || `/ideas?project=${id}`)

  try {
    const projectId = Number.parseInt(id, 10)
    const response = await generateProjectOriginalContentIdeas(projectId)
    const message = isCompletedOriginalContentIdeaGeneration(response)
      ? response.result.created > 0
        ? `Generated ${response.result.created} original content idea${response.result.created === 1 ? "" : "s"}.`
        : "No new original content ideas were created."
      : "Original content idea generation queued."

    return NextResponse.redirect(
      buildTrendRedirectUrl(request, redirectTo, { message }),
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to generate original content ideas."
    return NextResponse.redirect(
      buildTrendRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}