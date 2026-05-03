import { NextResponse } from "next/server"

import {
  acceptEntityCandidate,
  mergeEntityCandidate,
  rejectEntityCandidate,
} from "@/lib/api"

function buildRedirectUrl(
  request: Request,
  redirectTo: string,
  params: Record<string, string>,
) {
  const url = new URL(redirectTo || "/entities/candidates", request.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

/**
 * Handle bulk candidate review actions for one clustered candidate group.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const responseMode = new URL(request.url).searchParams.get("mode")
  const formData = await request.formData()
  const redirectTo = String(
    formData.get("redirectTo") || `/entities/candidates?project=${id}`,
  )

  try {
    const projectId = Number.parseInt(id, 10)
    const intent = String(formData.get("intent") || "accept")
    const candidateIds = formData
      .getAll("candidateId")
      .map((value) => Number.parseInt(String(value), 10))
      .filter((candidateId) => Number.isInteger(candidateId) && candidateId > 0)

    if (candidateIds.length === 0) {
      throw new Error("Select at least one entity candidate.")
    }

    let message = "Candidates accepted."

    if (intent === "reject") {
      for (const candidateId of candidateIds) {
        await rejectEntityCandidate(candidateId, projectId)
      }
      message = `Rejected ${candidateIds.length} candidate${candidateIds.length === 1 ? "" : "s"}.`
    } else if (intent === "merge") {
      const mergedInto = Number.parseInt(
        String(formData.get("mergedInto") || "0"),
        10,
      )
      if (!Number.isInteger(mergedInto) || mergedInto <= 0) {
        throw new Error("Select an entity to merge into.")
      }
      for (const candidateId of candidateIds) {
        await mergeEntityCandidate(candidateId, projectId, mergedInto)
      }
      message = `Merged ${candidateIds.length} candidate${candidateIds.length === 1 ? "" : "s"}.`
    } else {
      for (const candidateId of candidateIds) {
        await acceptEntityCandidate(candidateId, projectId)
      }
      message = `Accepted ${candidateIds.length} candidate${candidateIds.length === 1 ? "" : "s"}.`
    }

    if (responseMode === "json") {
      return NextResponse.json({ message })
    }

    return NextResponse.redirect(buildRedirectUrl(request, redirectTo, { message }))
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update entity candidates."

    if (responseMode === "json") {
      return NextResponse.json({ message }, { status: 400 })
    }

    return NextResponse.redirect(buildRedirectUrl(request, redirectTo, { error: message }))
  }
}
