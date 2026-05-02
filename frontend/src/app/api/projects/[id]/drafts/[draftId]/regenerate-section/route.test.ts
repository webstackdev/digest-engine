import { beforeEach, describe, expect, it, vi } from "vitest"

import { regenerateProjectNewsletterDraftSection } from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  regenerateProjectNewsletterDraftSection: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/drafts/9/regenerate-section", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects/[id]/drafts/[draftId]/regenerate-section", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("redirects with a success message when regeneration completes immediately", async () => {
    vi.mocked(regenerateProjectNewsletterDraftSection).mockResolvedValue({
      id: 9,
      project: 4,
      title: "Updated draft",
      intro: "Intro",
      outro: "Outro",
      target_publish_date: null,
      status: "edited",
      generated_at: "2026-05-03T09:00:00Z",
      last_edited_at: "2026-05-03T10:00:00Z",
      generation_metadata: {
        source_theme_ids: [1, 2],
        source_idea_ids: [4],
      },
      sections: [],
      original_pieces: [],
      rendered_markdown: "# Draft",
      rendered_html: "<h1>Draft</h1>",
    })

    const formData = new FormData()
    formData.set("redirectTo", "/drafts/9?project=4")
    formData.set("sectionId", "12")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4", draftId: "9" }),
    })

    expect(regenerateProjectNewsletterDraftSection).toHaveBeenCalledWith(4, 9, 12)
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/drafts/9?project=4&message=Draft+section+regenerated.",
    )
  })

  it("redirects with a queued message when regeneration is deferred", async () => {
    vi.mocked(regenerateProjectNewsletterDraftSection).mockResolvedValue({
      status: "queued",
      draft_id: 9,
      section_id: 12,
    })

    const formData = new FormData()
    formData.set("sectionId", "12")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4", draftId: "9" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/drafts/9?project=4&message=Draft+section+regeneration+queued.",
    )
  })

  it("returns JSON mode responses for inline regeneration", async () => {
    vi.mocked(regenerateProjectNewsletterDraftSection).mockResolvedValue({
      status: "queued",
      draft_id: 9,
      section_id: 12,
    })

    const formData = new FormData()
    formData.set("sectionId", "12")

    const response = await POST(
      new Request(
        "http://localhost/api/projects/4/drafts/9/regenerate-section?mode=json",
        {
          method: "POST",
          body: formData,
        },
      ),
      {
        params: Promise.resolve({ id: "4", draftId: "9" }),
      },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: "Draft section regeneration queued.",
    })
  })
})