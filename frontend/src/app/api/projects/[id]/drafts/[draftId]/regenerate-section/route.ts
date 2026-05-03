import { NextResponse } from "next/server"

import { regenerateProjectNewsletterDraftSection } from "@/lib/api"

import { buildDraftRedirectUrl } from "../../../draft-action-helpers"

/**
 * Handle per-section newsletter draft regeneration requests.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; draftId: string }> },
) {
  const { id, draftId } = await context.params
  const responseMode = new URL(request.url).searchParams.get("mode")
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || `/drafts/${draftId}?project=${id}`)

  try {
    const response = await regenerateProjectNewsletterDraftSection(
      Number.parseInt(id, 10),
      Number.parseInt(draftId, 10),
      Number.parseInt(String(formData.get("sectionId") || "0"), 10),
    )
    const message = "section_id" in response
      ? "Draft section regeneration queued."
      : "Draft section regenerated."

    if (responseMode === "json") {
      return NextResponse.json({ message })
    }

    return NextResponse.redirect(
      buildDraftRedirectUrl(request, redirectTo, { message }),
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to regenerate draft section."

    if (responseMode === "json") {
      return NextResponse.json({ message }, { status: 400 })
    }

    return NextResponse.redirect(
      buildDraftRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
