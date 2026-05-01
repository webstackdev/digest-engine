import { beforeEach, describe, expect, it, vi } from "vitest"

import { acceptMembershipInvitation } from "@/lib/api"

import { POST } from "../route"

vi.mock("@/lib/api", () => ({
  acceptMembershipInvitation: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/invitations/abc123/accept", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/invitations/[token]/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("accepts an invitation and redirects into the invited project", async () => {
    vi.mocked(acceptMembershipInvitation).mockResolvedValue({
      token: "abc123",
      project_id: 9,
      project_name: "Invited Project",
      email: "invitee@example.com",
      role: "member",
      status: "accepted",
      accepted_at: "2026-04-30T00:00:00Z",
      revoked_at: null,
    })

    const formData = new FormData()
    formData.set("redirectTo", "/invite/abc123")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ token: "abc123" }),
    })

    expect(acceptMembershipInvitation).toHaveBeenCalledWith("abc123")
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/?project=9&message=Joined+Invited+Project.",
    )
  })

  it("redirects with the thrown error message when invitation acceptance fails", async () => {
    vi.mocked(acceptMembershipInvitation).mockRejectedValue(
      new Error("Invitation accept failed"),
    )

    const formData = new FormData()
    formData.set("redirectTo", "/invite/abc123")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ token: "abc123" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/invite/abc123?error=Invitation+accept+failed",
    )
  })

  it("redirects with the fallback error when a non-Error value is thrown", async () => {
    vi.mocked(acceptMembershipInvitation).mockRejectedValue("boom")

    const response = await POST(buildRequest(new FormData()), {
      params: Promise.resolve({ token: "abc123" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/invite/abc123?error=Unable+to+accept+invitation.",
    )
  })
})
