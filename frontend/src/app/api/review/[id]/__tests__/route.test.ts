import { beforeEach, describe, expect, it, vi } from "vitest"

import { updateReviewQueueItem } from "@/lib/api"

import { POST } from "../route"

vi.mock("@/lib/api", () => ({
  updateReviewQueueItem: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/review/7", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/review/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates a review item and redirects with a success message", async () => {
    vi.mocked(updateReviewQueueItem).mockResolvedValue(undefined)

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("redirectTo", "/content/9?project=4")
    formData.set("resolved", "true")
    formData.set("resolution", "human_approved")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "7" }),
    })

    expect(updateReviewQueueItem).toHaveBeenCalledWith(7, 4, {
      resolved: true,
      resolution: "human_approved",
    })
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/content/9?project=4&message=Review+item+updated.",
    )
  })

  it("treats missing resolved values as false", async () => {
    vi.mocked(updateReviewQueueItem).mockResolvedValue(undefined)

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("resolution", "needs_follow_up")

    await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "7" }),
    })

    expect(updateReviewQueueItem).toHaveBeenCalledWith(7, 4, {
      resolved: false,
      resolution: "needs_follow_up",
    })
  })

  it("redirects with the thrown error message when the API helper fails", async () => {
    vi.mocked(updateReviewQueueItem).mockRejectedValue(
      new Error("Review update failed"),
    )

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("redirectTo", "/content/9?project=4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "7" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/content/9?project=4&error=Review+update+failed",
    )
  })

  it("redirects with a fallback error when a non-Error value is thrown", async () => {
    vi.mocked(updateReviewQueueItem).mockRejectedValue("boom")

    const formData = new FormData()
    formData.set("projectId", "4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "7" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/?error=Unable+to+update+review+item.",
    )
  })
})