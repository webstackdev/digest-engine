import { beforeEach, describe, expect, it, vi } from "vitest"

import { createFeedback } from "@/lib/api"

import { POST } from "../route"

vi.mock("@/lib/api", () => ({
  createFeedback: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates feedback and redirects with a success message", async () => {
    vi.mocked(createFeedback).mockResolvedValue(undefined)

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("contentId", "9")
    formData.set("feedbackType", "downvote")
    formData.set("redirectTo", "/content/9?project=4")

    const response = await POST(buildRequest(formData))

    expect(createFeedback).toHaveBeenCalledWith(4, 9, "downvote")
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/content/9?project=4&message=Feedback+saved.",
    )
  })

  it("redirects with the thrown error message when feedback creation fails", async () => {
    vi.mocked(createFeedback).mockRejectedValue(new Error("Feedback failed"))

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("contentId", "9")
    formData.set("redirectTo", "/content/9?project=4")

    const response = await POST(buildRequest(formData))

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/content/9?project=4&error=Feedback+failed",
    )
  })

  it("redirects with a fallback error when a non-Error value is thrown", async () => {
    vi.mocked(createFeedback).mockRejectedValue("boom")

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("contentId", "9")

    const response = await POST(buildRequest(formData))

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/?error=Unable+to+save+feedback.",
    )
  })
})
