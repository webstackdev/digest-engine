import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createProjectConfig,
  recomputeProjectConfigAuthority,
  updateProjectConfig,
} from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  createProjectConfig: vi.fn(),
  recomputeProjectConfigAuthority: vi.fn(),
  updateProjectConfig: vi.fn(),
}))

describe("POST /api/projects/[id]/authority-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function buildFormData() {
    const formData = new FormData()
    formData.set("draft_schedule_cron", "")
    formData.set("authority_weight_mention", "0.2")
    formData.set("authority_weight_engagement", "0.15")
    formData.set("authority_weight_recency", "0.15")
    formData.set("authority_weight_source_quality", "0.15")
    formData.set("authority_weight_cross_newsletter", "0.2")
    formData.set("authority_weight_feedback", "0.1")
    formData.set("authority_weight_duplicate", "0.05")
    formData.set("upvote_authority_weight", "0.05")
    formData.set("downvote_authority_weight", "-0.05")
    formData.set("authority_decay_rate", "0.9")
    return formData
  }

  it("creates a config and returns JSON for a save request", async () => {
    vi.mocked(createProjectConfig).mockResolvedValue({ id: 7 } as never)

    const response = await POST(
      new Request("http://localhost/api/projects/4/authority-settings?mode=json", {
        method: "POST",
        body: buildFormData(),
      }),
      {
        params: Promise.resolve({ id: "4" }),
      },
    )

    expect(createProjectConfig).toHaveBeenCalledWith(
      4,
      expect.objectContaining({ authority_weight_engagement: 0.15 }),
    )
    expect(updateProjectConfig).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      configId: 7,
      message: "Authority weights saved.",
    })
  })

  it("updates and recomputes when requested", async () => {
    vi.mocked(updateProjectConfig).mockResolvedValue({ id: 9 } as never)
    vi.mocked(recomputeProjectConfigAuthority).mockResolvedValue({
      status: "completed",
      project_id: 4,
      config_id: 9,
    })

    const formData = buildFormData()
    formData.set("configId", "9")
    formData.set("intent", "save_and_recompute")

    const response = await POST(
      new Request("http://localhost/api/projects/4/authority-settings?mode=json", {
        method: "POST",
        body: formData,
      }),
      {
        params: Promise.resolve({ id: "4" }),
      },
    )

    expect(updateProjectConfig).toHaveBeenCalledWith(
      4,
      9,
      expect.objectContaining({ authority_weight_source_quality: 0.15 }),
    )
    expect(recomputeProjectConfigAuthority).toHaveBeenCalledWith(4, 9)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      configId: 9,
      message: "Authority weights saved and recomputed.",
    })
  })
})
