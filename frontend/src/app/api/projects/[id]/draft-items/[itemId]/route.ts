import { NextResponse } from "next/server"

import {
  deleteProjectNewsletterDraftItem,
  updateProjectNewsletterDraftItem,
} from "@/lib/api"

import { buildDraftRedirectUrl } from "../../draft-action-helpers"

async function swapItemOrder(
  projectId: number,
  itemId: number,
  currentOrder: number,
  targetOrder: number,
  swapWithId: number,
) {
  await updateProjectNewsletterDraftItem(itemId, projectId, { order: -1 })
  await updateProjectNewsletterDraftItem(swapWithId, projectId, {
    order: currentOrder,
  })
  await updateProjectNewsletterDraftItem(itemId, projectId, {
    order: targetOrder,
  })
}

/**
 * Handle inline draft-item updates, deletes, and reordering actions.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await context.params
  const responseMode = new URL(request.url).searchParams.get("mode")
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || `/drafts?project=${id}`)

  try {
    const projectId = Number.parseInt(id, 10)
    const resolvedItemId = Number.parseInt(itemId, 10)
    const intent = String(formData.get("intent") || "update")
    let message = "Draft item updated."

    if (intent === "delete") {
      await deleteProjectNewsletterDraftItem(resolvedItemId, projectId)
      message = "Draft item removed."
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

      await swapItemOrder(
        projectId,
        resolvedItemId,
        currentOrder,
        targetOrder,
        swapWithId,
      )
      message = intent === "move_up" ? "Draft item moved up." : "Draft item moved down."
    } else {
      await updateProjectNewsletterDraftItem(resolvedItemId, projectId, {
        summary_used: String(formData.get("summary_used") || ""),
        why_it_matters: String(formData.get("why_it_matters") || ""),
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
      error instanceof Error ? error.message : "Unable to save draft item."

    if (responseMode === "json") {
      return NextResponse.json({ message }, { status: 400 })
    }

    return NextResponse.redirect(
      buildDraftRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}