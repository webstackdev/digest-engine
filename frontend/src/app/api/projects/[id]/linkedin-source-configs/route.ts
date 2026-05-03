import { NextResponse } from "next/server"

import { createSourceConfig } from "@/lib/api"

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
 * Handle typed LinkedIn source-config creation requests.
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
    const surface = String(formData.get("surface") || "organization")
    const urn = String(formData.get("urn") || "").trim()
    if (!urn) {
      throw new Error("Enter a LinkedIn URN.")
    }

    const config: Record<string, unknown> = {}
    if (surface === "person") {
      config.person_urn = urn
      config.include_reshares =
        String(formData.get("include_reshares") || "false") === "true"
    } else if (surface === "newsletter") {
      config.newsletter_urn = urn
      config.max_posts_per_fetch = Number.parseInt(
        String(formData.get("max_posts_per_fetch") || "25"),
        10,
      )
    } else {
      config.organization_urn = urn
      config.max_posts_per_fetch = Number.parseInt(
        String(formData.get("max_posts_per_fetch") || "50"),
        10,
      )
    }

    await createSourceConfig(projectId, {
      plugin_name: "linkedin",
      config,
      is_active: String(formData.get("is_active") || "true") === "true",
    })

    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { message: "LinkedIn source created." }),
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to create LinkedIn source configuration."
    return NextResponse.redirect(buildRedirectUrl(request, redirectTo, { error: message }))
  }
}
