import { NextResponse } from "next/server"

import {
  createProjectMastodonCredentials,
  updateProjectMastodonCredentials,
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
 * Handle Mastodon credential create/update form submissions for one project.
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
      instance_url: String(formData.get("instance_url") || ""),
      account_acct: String(formData.get("account_acct") || ""),
      is_active: String(formData.get("is_active") || "true") === "true",
      access_token: String(formData.get("access_token") || ""),
    }

    if (credentialId > 0) {
      await updateProjectMastodonCredentials(projectId, credentialId, payload)
      return NextResponse.redirect(
        buildRedirectUrl(request, redirectTo, {
          message: "Mastodon credentials updated.",
        }),
      )
    }

    await createProjectMastodonCredentials(projectId, payload)
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, {
        message: "Mastodon credentials saved.",
      }),
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save Mastodon credentials."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}