import { NextResponse } from "next/server"

import {
  createProjectBlueskyCredentials,
  updateProjectBlueskyCredentials,
} from "@/lib/api"

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
 * Handle Bluesky credential create/update form submissions for one project.
 *
 * @param request - Incoming form submission request.
 * @param context - Route params containing the project id.
 * @returns A redirect response pointing back to the sources UI.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || "/admin/sources")

  try {
    const projectId = Number.parseInt(id, 10)
    const credentialId = Number.parseInt(
      String(formData.get("credentialId") || "0"),
      10,
    )
    const payload = {
      handle: String(formData.get("handle") || ""),
      pds_url: String(formData.get("pds_url") || ""),
      is_active: String(formData.get("is_active") || "true") === "true",
      app_password: String(formData.get("app_password") || ""),
    }

    if (credentialId > 0) {
      await updateProjectBlueskyCredentials(projectId, credentialId, payload)
      return NextResponse.redirect(
        buildRedirectUrl(request, redirectTo, {
          message: "Bluesky credentials updated.",
        }),
      )
    }

    await createProjectBlueskyCredentials(projectId, payload)
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, {
        message: "Bluesky credentials saved.",
      }),
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save Bluesky credentials."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}