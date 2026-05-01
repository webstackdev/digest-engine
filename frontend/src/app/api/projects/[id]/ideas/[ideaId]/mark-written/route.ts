import { NextResponse } from "next/server"

import { markProjectOriginalContentIdeaWritten } from "@/lib/api"

import { buildTrendRedirectUrl } from "../../../trend-action-helpers"

/**
 * Handle mark-written requests for accepted original-content ideas.
 *
 * @param request - Incoming form submission request.
 * @param context - Route params containing the project id and idea id.
 * @returns A redirect response pointing back to the ideas page with a flash message.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; ideaId: string }> },
) {
  const { id, ideaId } = await context.params
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || `/ideas?project=${id}`)

  try {
    await markProjectOriginalContentIdeaWritten(
      Number.parseInt(id, 10),
      Number.parseInt(ideaId, 10),
    )
    return NextResponse.redirect(
      buildTrendRedirectUrl(request, redirectTo, {
        message: "Original content idea marked written.",
      }),
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to mark original content idea written."
    return NextResponse.redirect(
      buildTrendRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}