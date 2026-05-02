import { beforeEach, describe, expect, it, vi } from "vitest"

import { startProjectLinkedInOAuth } from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  startProjectLinkedInOAuth: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/linkedin-oauth/start", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects/[id]/linkedin-oauth/start", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("redirects to the LinkedIn authorization URL", async () => {
    vi.mocked(startProjectLinkedInOAuth).mockResolvedValue({
      authorize_url: "https://www.linkedin.com/oauth/v2/authorization?state=signed-state",
    })

    const formData = new FormData()
    formData.set("redirectTo", "/admin/sources?project=4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(startProjectLinkedInOAuth).toHaveBeenCalledWith(
      4,
      "/admin/sources?project=4",
    )
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "https://www.linkedin.com/oauth/v2/authorization?state=signed-state",
    )
  })

  it("redirects back with the thrown error message when authorization start fails", async () => {
    vi.mocked(startProjectLinkedInOAuth).mockRejectedValue(
      new Error("LinkedIn authorization failed"),
    )

    const formData = new FormData()
    formData.set("redirectTo", "/admin/sources?project=4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&error=LinkedIn+authorization+failed",
    )
  })

  it("redirects back with a fallback error when a non-Error value is thrown", async () => {
    vi.mocked(startProjectLinkedInOAuth).mockRejectedValue("boom")

    const response = await POST(buildRequest(new FormData()), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?error=Unable+to+start+LinkedIn+authorization.",
    )
  })
})