import { beforeEach, describe, expect, it, vi } from "vitest"

import { verifyProjectMastodonCredentials } from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  verifyProjectMastodonCredentials: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request(
    "http://localhost/api/projects/4/verify-mastodon-credentials",
    {
      method: "POST",
      body: formData,
    },
  )
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects/[id]/verify-mastodon-credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("verifies Mastodon credentials and redirects with a success message", async () => {
    vi.mocked(verifyProjectMastodonCredentials).mockResolvedValue({
      status: "verified",
      account_acct: "alice@hachyderm.io",
      instance_url: "https://hachyderm.io",
      last_verified_at: "2026-04-29T10:00:00Z",
      last_error: "",
    })

    const formData = new FormData()
    formData.set("redirectTo", "/admin/sources?project=4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(verifyProjectMastodonCredentials).toHaveBeenCalledWith(4)
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&message=Verified+Mastodon+account+alice%40hachyderm.io.",
    )
  })

  it("redirects with the thrown error message when verification fails", async () => {
    vi.mocked(verifyProjectMastodonCredentials).mockRejectedValue(
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
    vi.mocked(verifyProjectMastodonCredentials).mockRejectedValue("boom")

    const response = await POST(buildRequest(new FormData()), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?error=Unable+to+verify+Mastodon+credentials.",
    )
  })
})
