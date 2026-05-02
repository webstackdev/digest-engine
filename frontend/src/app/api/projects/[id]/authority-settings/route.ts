import { NextResponse } from "next/server"

import {
  createProjectConfig,
  recomputeProjectConfigAuthority,
  updateProjectConfig,
} from "@/lib/api"

type AuthorityWeightsPayload = {
  draft_schedule_cron: string
  authority_weight_mention: number
  authority_weight_engagement: number
  authority_weight_recency: number
  authority_weight_source_quality: number
  authority_weight_cross_newsletter: number
  authority_weight_feedback: number
  authority_weight_duplicate: number
  upvote_authority_weight: number
  downvote_authority_weight: number
  authority_decay_rate: number
}

function buildRedirectUrl(
  request: Request,
  redirectTo: string,
  params: Record<string, string>,
) {
  const url = new URL(redirectTo || "/", request.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

function parseNumericField(formData: FormData, fieldName: keyof AuthorityWeightsPayload) {
  return Number.parseFloat(String(formData.get(fieldName) || "0"))
}

function extractPayload(formData: FormData): AuthorityWeightsPayload {
  return {
    draft_schedule_cron: String(formData.get("draft_schedule_cron") || ""),
    authority_weight_mention: parseNumericField(formData, "authority_weight_mention"),
    authority_weight_engagement: parseNumericField(formData, "authority_weight_engagement"),
    authority_weight_recency: parseNumericField(formData, "authority_weight_recency"),
    authority_weight_source_quality: parseNumericField(formData, "authority_weight_source_quality"),
    authority_weight_cross_newsletter: parseNumericField(formData, "authority_weight_cross_newsletter"),
    authority_weight_feedback: parseNumericField(formData, "authority_weight_feedback"),
    authority_weight_duplicate: parseNumericField(formData, "authority_weight_duplicate"),
    upvote_authority_weight: parseNumericField(formData, "upvote_authority_weight"),
    downvote_authority_weight: parseNumericField(formData, "downvote_authority_weight"),
    authority_decay_rate: parseNumericField(formData, "authority_decay_rate"),
  }
}

/**
 * Handle authority-weight save and recompute requests for one project.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const responseMode = new URL(request.url).searchParams.get("mode")
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || `/entities?project=${id}`)

  try {
    const projectId = Number.parseInt(id, 10)
    const configId = Number.parseInt(String(formData.get("configId") || "0"), 10)
    const intent = String(formData.get("intent") || "save")
    const payload = extractPayload(formData)

    const config =
      configId > 0
        ? await updateProjectConfig(projectId, configId, payload)
        : await createProjectConfig(projectId, payload)

    let message = "Authority weights saved."

    if (intent === "save_and_recompute") {
      const recompute = await recomputeProjectConfigAuthority(projectId, config.id)
      message =
        recompute.status === "completed"
          ? "Authority weights saved and recomputed."
          : "Authority weights saved and recompute queued."
    }

    if (responseMode === "json") {
      return NextResponse.json({ configId: config.id, message })
    }

    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { message }),
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to save authority settings."

    if (responseMode === "json") {
      return NextResponse.json({ message }, { status: 400 })
    }

    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}