import { NextResponse } from "next/server"

import { dismissProjectOriginalContentIdea } from "@/lib/api"

import { buildTrendRedirectUrl } from "../../../trend-action-helpers"

/**
 * Handle original-content idea dismissal requests.
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
    await dismissProjectOriginalContentIdea(
      Number.parseInt(id, 10),
      Number.parseInt(ideaId, 10),
      String(formData.get("reason") || ""),
    )
    return NextResponse.redirect(
      buildTrendRedirectUrl(request, redirectTo, {
        message: "Original content idea dismissed.",
      }),
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to dismiss original content idea."
    return NextResponse.redirect(
      buildTrendRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
