import { NextResponse } from "next/server"

import {
  acceptEntityCandidate,
  mergeEntityCandidate,
  rejectEntityCandidate,
} from "@/lib/api"

/**
 * Build a redirect target for the entity-candidate form handlers.
 *
 * @param request - Incoming request used as the base URL for relative redirects.
 * @param redirectTo - Caller-provided redirect target, or a fallback path.
 * @param params - Query params to append to the redirect target.
 * @returns A redirect URL with the provided flash-message params.
 */
function buildRedirectUrl(
  request: Request,
  redirectTo: string,
  params: Record<string, string>,
) {
  const url = new URL(redirectTo || "/entities", request.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

/**
 * Handle entity-candidate review form submissions.
 *
 * @param request - Incoming form submission request.
 * @param context - Route params containing the entity-candidate id.
 * @returns A redirect response pointing back to the entities UI.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || "/entities")

  try {
    const projectId = Number.parseInt(String(formData.get("projectId") || "0"), 10)
    const candidateId = Number.parseInt(id, 10)
    const intent = String(formData.get("intent") || "accept")

    if (intent === "reject") {
      await rejectEntityCandidate(candidateId, projectId)
      return NextResponse.redirect(
        buildRedirectUrl(request, redirectTo, { message: "Candidate rejected." }),
      )
    }

    if (intent === "merge") {
      const mergedInto = Number.parseInt(
        String(formData.get("mergedInto") || "0"),
        10,
      )
      if (!Number.isInteger(mergedInto) || mergedInto <= 0) {
        throw new Error("Select an entity to merge into.")
      }
      await mergeEntityCandidate(candidateId, projectId, mergedInto)
      return NextResponse.redirect(
        buildRedirectUrl(request, redirectTo, { message: "Candidate merged." }),
      )
    }

    await acceptEntityCandidate(candidateId, projectId)
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { message: "Candidate accepted." }),
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update entity candidate."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}
