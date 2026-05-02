import { beforeEach, describe, expect, it, vi } from "vitest"

import { updateProjectNewsletterDraft } from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  updateProjectNewsletterDraft: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/drafts/9", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects/[id]/drafts/[draftId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates the draft and redirects with a success message", async () => {
    vi.mocked(updateProjectNewsletterDraft).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("redirectTo", "/drafts/9?project=4")
    formData.set("title", "Updated draft")
    formData.set("intro", "Updated intro")
    formData.set("outro", "Updated outro")
    formData.set("target_publish_date", "2026-05-10")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4", draftId: "9" }),
    })

    expect(updateProjectNewsletterDraft).toHaveBeenCalledWith(4, 9, {
      title: "Updated draft",
      intro: "Updated intro",
      outro: "Updated outro",
      target_publish_date: "2026-05-10",
    })
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/drafts/9?project=4&message=Draft+updated.",
    )
  })

  it("normalizes an empty publish date to null", async () => {
    vi.mocked(updateProjectNewsletterDraft).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("title", "Updated draft")
    formData.set("intro", "")
    formData.set("outro", "")
    formData.set("target_publish_date", "")

    await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4", draftId: "9" }),
    })

    expect(updateProjectNewsletterDraft).toHaveBeenCalledWith(4, 9, {
      title: "Updated draft",
      intro: "",
      outro: "",
      target_publish_date: null,
    })
  })

  it("returns JSON mode responses for client-side saves", async () => {
    vi.mocked(updateProjectNewsletterDraft).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("title", "Updated draft")
    formData.set("intro", "Updated intro")
    formData.set("outro", "Updated outro")
    formData.set("target_publish_date", "2026-05-10")

    const response = await POST(
      new Request("http://localhost/api/projects/4/drafts/9?mode=json", {
        method: "POST",
        body: formData,
      }),
      {
        params: Promise.resolve({ id: "4", draftId: "9" }),
      },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: "Draft updated." })
  })
})