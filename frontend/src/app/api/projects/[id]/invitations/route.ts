import { NextResponse } from "next/server"

import { createProjectInvitation } from "@/lib/api"

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
 * Handle invitation form submissions for one project.
 *
 * @param request - Incoming form submission request.
 * @param context - Route params containing the project id.
 * @returns A redirect response back to the invitation UI.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const formData = await request.formData()
  const redirectTo = String(
    formData.get("redirectTo") || `/projects/${id}/members/invite`,
  )

  try {
    const projectId = Number.parseInt(id, 10)
    await createProjectInvitation(projectId, {
      email: String(formData.get("email") || "").trim(),
      role: String(formData.get("role") || "member") as "admin" | "member" | "reader",
    })
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { message: "Invitation sent." }),
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send invitation."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
