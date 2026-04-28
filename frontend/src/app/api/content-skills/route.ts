import { NextResponse } from "next/server"

import { getContentSkillResults } from "@/lib/api"

/**
 * Proxy content-level skill results through a frontend App Router endpoint.
 *
 * This route keeps client-side polling code on the same origin while reusing the
 * shared backend API helpers. Requests must provide both `projectId` and `contentId`
 * query params. Missing or invalid ids return `400`, and downstream API failures are
 * normalized into a JSON error payload for the UI.
 *
 * @param request - Incoming request containing `projectId` and `contentId` search params.
 * @returns A JSON response with skill results or an error payload.
 * @example
 * ```ts
 * const response = await GET(
 *   new Request("http://localhost/api/content-skills?projectId=4&contentId=9"),
 * )
 * ```
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const projectId = Number.parseInt(url.searchParams.get("projectId") || "0", 10)
  const contentId = Number.parseInt(
    url.searchParams.get("contentId") || "0",
    10,
  )

  if (!projectId || !contentId) {
    return NextResponse.json(
      { error: "projectId and contentId are required." },
      { status: 400 },
    )
  }

  try {
    const skillResults = await getContentSkillResults(projectId, contentId)
    return NextResponse.json(skillResults)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load content skill results."

    return NextResponse.json({ error: message }, { status: 400 })
  }
}
