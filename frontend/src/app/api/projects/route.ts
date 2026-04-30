import { NextResponse } from "next/server"

import { createProject } from "@/lib/api"

function buildRedirectUrl(
  request: Request,
  redirectTo: string,
  params: Record<string, string>,
) {
  const url = new URL(redirectTo || "/admin/projects/new", request.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

/**
 * Handle project-creation form submissions.
 *
 * @param request - Incoming form submission request.
 * @returns A redirect response pointing to the new project's members page.
 */
export async function POST(request: Request) {
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || "/admin/projects/new")

  try {
    const retentionDays = Number.parseInt(
      String(formData.get("content_retention_days") || "365"),
      10,
    )
    const project = await createProject({
      name: String(formData.get("name") || "").trim(),
      topic_description: String(formData.get("topic_description") || "").trim(),
      content_retention_days: Number.isNaN(retentionDays) ? 365 : retentionDays,
    })

    return NextResponse.redirect(
      buildRedirectUrl(
        request,
        `/projects/${project.id}/members?project=${project.id}`,
        { message: `Created ${project.name}.` },
      ),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create project."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
