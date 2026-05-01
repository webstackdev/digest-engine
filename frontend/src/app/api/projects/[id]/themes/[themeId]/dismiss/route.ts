import { NextResponse } from "next/server"

import { dismissProjectThemeSuggestion } from "@/lib/api"

import { buildTrendRedirectUrl } from "../../../trend-action-helpers"

/**
 * Handle theme dismissal requests from the themes queue.
 *
 * @param request - Incoming form submission request.
 * @param context - Route params containing the project id and theme id.
 * @returns A redirect response pointing back to the themes page with a flash message.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; themeId: string }> },
) {
  const { id, themeId } = await context.params
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || `/themes?project=${id}`)

  try {
    await dismissProjectThemeSuggestion(
      Number.parseInt(id, 10),
      Number.parseInt(themeId, 10),
      String(formData.get("reason") || ""),
    )
    return NextResponse.redirect(
      buildTrendRedirectUrl(request, redirectTo, {
        message: "Theme dismissed.",
      }),
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to dismiss theme."
    return NextResponse.redirect(
      buildTrendRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}