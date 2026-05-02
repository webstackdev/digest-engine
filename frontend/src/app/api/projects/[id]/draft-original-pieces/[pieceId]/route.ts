import { NextResponse } from "next/server"

import {
  deleteProjectNewsletterDraftOriginalPiece,
  updateProjectNewsletterDraftOriginalPiece,
} from "@/lib/api"

import { buildDraftRedirectUrl } from "../../draft-action-helpers"

async function swapOriginalPieceOrder(
  projectId: number,
  pieceId: number,
  currentOrder: number,
  targetOrder: number,
  swapWithId: number,
) {
  await updateProjectNewsletterDraftOriginalPiece(pieceId, projectId, {
    order: -1,
  })
  await updateProjectNewsletterDraftOriginalPiece(swapWithId, projectId, {
    order: currentOrder,
  })
  await updateProjectNewsletterDraftOriginalPiece(pieceId, projectId, {
    order: targetOrder,
  })
}

/**
 * Handle inline original-piece updates, deletes, and reordering actions.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; pieceId: string }> },
) {
  const { id, pieceId } = await context.params
  const responseMode = new URL(request.url).searchParams.get("mode")
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || `/drafts?project=${id}`)

  try {
    const projectId = Number.parseInt(id, 10)
    const resolvedPieceId = Number.parseInt(pieceId, 10)
    const intent = String(formData.get("intent") || "update")
    let message = "Original piece updated."

    if (intent === "delete") {
      await deleteProjectNewsletterDraftOriginalPiece(resolvedPieceId, projectId)
      message = "Original piece removed."
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

      await swapOriginalPieceOrder(
        projectId,
        resolvedPieceId,
        currentOrder,
        targetOrder,
        swapWithId,
      )
      message = intent === "move_up" ? "Original piece moved up." : "Original piece moved down."
    } else {
      await updateProjectNewsletterDraftOriginalPiece(resolvedPieceId, projectId, {
        title: String(formData.get("title") || ""),
        pitch: String(formData.get("pitch") || ""),
        suggested_outline: String(formData.get("suggested_outline") || ""),
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
      error instanceof Error ? error.message : "Unable to save original piece."

    if (responseMode === "json") {
      return NextResponse.json({ message }, { status: 400 })
    }

    return NextResponse.redirect(
      buildDraftRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}