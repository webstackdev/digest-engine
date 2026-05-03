import { NextResponse } from "next/server"

import { updateProjectNewsletterDraft } from "@/lib/api"

import { buildDraftRedirectUrl } from "../../draft-action-helpers"

/**
 * Handle top-level newsletter draft edits.
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
    await updateProjectNewsletterDraft(Number.parseInt(id, 10), Number.parseInt(draftId, 10), {
      title: String(formData.get("title") || ""),
      intro: String(formData.get("intro") || ""),
      outro: String(formData.get("outro") || ""),
      target_publish_date: String(formData.get("target_publish_date") || "") || null,
    })

    if (responseMode === "json") {
      return NextResponse.json({ message: "Draft updated." })
    }

    return NextResponse.redirect(
      buildDraftRedirectUrl(request, redirectTo, { message: "Draft updated." }),
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save newsletter draft."

    if (responseMode === "json") {
      return NextResponse.json({ message }, { status: 400 })
    }

    return NextResponse.redirect(
      buildDraftRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
