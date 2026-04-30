import { NextResponse } from "next/server"

import { deleteProjectMembership, updateProjectMembership } from "@/lib/api"

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
 * Handle member role updates and removals for one project roster row.
 *
 * @param request - Incoming form submission request.
 * @param context - Route params containing the project and membership ids.
 * @returns A redirect response back to the members page.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; membershipId: string }> },
) {
  const { id, membershipId } = await context.params
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || `/projects/${id}/members`)

  try {
    const projectId = Number.parseInt(id, 10)
    const parsedMembershipId = Number.parseInt(membershipId, 10)
    const intent = String(formData.get("intent") || "update-role")

    if (intent === "remove") {
      await deleteProjectMembership(projectId, parsedMembershipId)
      return NextResponse.redirect(
        buildRedirectUrl(request, redirectTo, { message: "Member removed." }),
      )
    }

    await updateProjectMembership(projectId, parsedMembershipId, {
      role: String(formData.get("role") || "member") as "admin" | "member" | "reader",
    })
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { message: "Role updated." }),
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update membership."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
