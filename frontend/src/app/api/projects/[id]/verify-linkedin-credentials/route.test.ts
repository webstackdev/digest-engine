import { beforeEach, describe, expect, it, vi } from "vitest"

import { verifyProjectLinkedInCredentials } from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  verifyProjectLinkedInCredentials: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/verify-linkedin-credentials", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects/[id]/verify-linkedin-credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("verifies LinkedIn credentials and redirects with a success message", async () => {
    vi.mocked(verifyProjectLinkedInCredentials).mockResolvedValue({
      status: "verified",
      member_urn: "urn:li:person:abc123",
      expires_at: "2026-04-29T10:00:00Z",
      last_verified_at: "2026-04-29T10:00:00Z",
      last_error: "",
    })

    const formData = new FormData()
    formData.set("redirectTo", "/admin/sources?project=4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(verifyProjectLinkedInCredentials).toHaveBeenCalledWith(4)
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&message=Verified+LinkedIn+member+urn%3Ali%3Aperson%3Aabc123.",
    )
  })

  it("redirects with the thrown error message when verification fails", async () => {
    vi.mocked(verifyProjectLinkedInCredentials).mockRejectedValue(
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
    vi.mocked(verifyProjectLinkedInCredentials).mockRejectedValue("boom")

    const response = await POST(buildRequest(new FormData()), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?error=Unable+to+verify+LinkedIn+credentials.",
    )
  })
})
