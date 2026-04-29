import { NextResponse } from "next/server"

import { deleteProjectIntakeAllowlistEntry } from "@/lib/api"

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
 * Handle allowlist delete actions for one project sender.
 *
 * @param request - Incoming form submission request.
 * @param context - Route params containing the project and allowlist ids.
 * @returns A redirect response pointing back to the sources UI.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; allowlistId: string }> },
) {
  const { id, allowlistId } = await context.params
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || "/admin/sources")

  try {
    const projectId = Number.parseInt(id, 10)
    const parsedAllowlistId = Number.parseInt(allowlistId, 10)
    await deleteProjectIntakeAllowlistEntry(parsedAllowlistId, projectId)
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, {
        message: "Sender removed from intake allowlist.",
      }),
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update intake allowlist."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}