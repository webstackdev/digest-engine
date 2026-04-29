import { beforeEach, describe, expect, it, vi } from "vitest"

import { verifyProjectBlueskyCredentials } from "@/lib/api"

import { POST } from "../route"

vi.mock("@/lib/api", () => ({
  verifyProjectBlueskyCredentials: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/verify-bluesky-credentials", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects/[id]/verify-bluesky-credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("verifies Bluesky credentials and redirects with a success message", async () => {
    vi.mocked(verifyProjectBlueskyCredentials).mockResolvedValue({
      status: "verified",
      handle: "project.bsky.social",
      last_verified_at: "2026-04-29T10:00:00Z",
      last_error: "",
    })

    const formData = new FormData()
    formData.set("redirectTo", "/admin/sources?project=4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(verifyProjectBlueskyCredentials).toHaveBeenCalledWith(4)
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&message=Verified+Bluesky+account+project.bsky.social.",
    )
  })

  it("redirects with the thrown error message when verification fails", async () => {
    vi.mocked(verifyProjectBlueskyCredentials).mockRejectedValue(
      new Error("Verification failed"),
    )

    const formData = new FormData()
    formData.set("redirectTo", "/admin/sources?project=4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&error=Verification+failed",
    )
  })

  it("redirects with a fallback error when a non-Error value is thrown", async () => {
    vi.mocked(verifyProjectBlueskyCredentials).mockRejectedValue("boom")

    const response = await POST(buildRequest(new FormData()), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?error=Unable+to+verify+Bluesky+credentials.",
    )
  })
})