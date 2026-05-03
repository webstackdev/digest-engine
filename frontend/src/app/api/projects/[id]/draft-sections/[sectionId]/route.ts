import { NextResponse } from "next/server"

import {
  deleteProjectNewsletterDraftSection,
  updateProjectNewsletterDraftSection,
} from "@/lib/api"

import { buildDraftRedirectUrl } from "../../draft-action-helpers"

async function swapSectionOrder(
  projectId: number,
  sectionId: number,
  currentOrder: number,
  targetOrder: number,
  swapWithId: number,
) {
  await updateProjectNewsletterDraftSection(sectionId, projectId, { order: -1 })
  await updateProjectNewsletterDraftSection(swapWithId, projectId, {
    order: currentOrder,
  })
  await updateProjectNewsletterDraftSection(sectionId, projectId, {
    order: targetOrder,
  })
}

/**
 * Handle inline draft-section updates, deletes, and reordering actions.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; sectionId: string }> },
) {
  const { id, sectionId } = await context.params
  const responseMode = new URL(request.url).searchParams.get("mode")
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || `/drafts?project=${id}`)

  try {
    const projectId = Number.parseInt(id, 10)
    const resolvedSectionId = Number.parseInt(sectionId, 10)
    const intent = String(formData.get("intent") || "update")
    let message = "Section updated."

    if (intent === "delete") {
      await deleteProjectNewsletterDraftSection(resolvedSectionId, projectId)
      message = "Section removed."
    } else if (intent === "move_up" || intent === "move_down") {
      const currentOrder = Number.parseInt(
        String(formData.get("currentOrder") || "0"),
        10,
      )
      const targetOrder = Number.parseInt(
        String(formData.get("targetOrder") || String(currentOrder)),
        10,
      )
      const swapWithId = Number.parseInt(
        String(formData.get("swapWithId") || "0"),
        10,
      )

      await swapSectionOrder(
        projectId,
        resolvedSectionId,
        currentOrder,
        targetOrder,
        swapWithId,
      )
      message = intent === "move_up" ? "Section moved up." : "Section moved down."
    } else {
      await updateProjectNewsletterDraftSection(resolvedSectionId, projectId, {
        title: String(formData.get("title") || ""),
        lede: String(formData.get("lede") || ""),
      })
    }

    if (responseMode === "json") {
      return NextResponse.json({ message })
    }

    return NextResponse.redirect(
      buildDraftRedirectUrl(request, redirectTo, { message }),
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save draft section."

    if (responseMode === "json") {
      return NextResponse.json({ message }, { status: 400 })
    }

    return NextResponse.redirect(
      buildDraftRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
