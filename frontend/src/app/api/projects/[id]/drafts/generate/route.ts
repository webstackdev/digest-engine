import { NextResponse } from "next/server"

import {
  generateProjectNewsletterDraft,
  isCompletedNewsletterDraftGeneration,
} from "@/lib/api"

import { buildDraftRedirectUrl } from "../../draft-action-helpers"

/**
 * Handle manual newsletter draft generation requests from the drafts queue.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || `/drafts?project=${id}`)

  try {
    const projectId = Number.parseInt(id, 10)
    const response = await generateProjectNewsletterDraft(projectId)
    const message = isCompletedNewsletterDraftGeneration(response)
      ? response.result.draft_id
        ? "Newsletter draft generated."
        : response.result.reason === "insufficient_inputs"
          ? "No newsletter draft was created because the project needs at least two accepted themes and one accepted original idea."
          : "No newsletter draft was created."
      : "Newsletter draft generation queued."

    return NextResponse.redirect(
      buildDraftRedirectUrl(request, redirectTo, { message }),
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate newsletter draft."
    return NextResponse.redirect(
      buildDraftRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}