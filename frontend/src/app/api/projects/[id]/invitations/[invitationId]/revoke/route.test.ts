import { beforeEach, describe, expect, it, vi } from "vitest"

import { revokeProjectInvitation } from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  revokeProjectInvitation: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/invitations/7/revoke", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects/[id]/invitations/[invitationId]/revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("revokes an invitation and redirects with a success message", async () => {
    vi.mocked(revokeProjectInvitation).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("redirectTo", "/projects/4/members?project=4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4", invitationId: "7" }),
    })

    expect(revokeProjectInvitation).toHaveBeenCalledWith(4, 7)
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/projects/4/members?project=4&message=Invitation+revoked.",
    )
  })

  it("uses the default members redirect when no redirect target is provided", async () => {
    vi.mocked(revokeProjectInvitation).mockResolvedValue(undefined as never)

    const response = await POST(buildRequest(new FormData()), {
      params: Promise.resolve({ id: "4", invitationId: "7" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/projects/4/members?message=Invitation+revoked.",
    )
  })

  it("redirects with the fallback error when a non-Error value is thrown", async () => {
    vi.mocked(revokeProjectInvitation).mockRejectedValue("boom")

    const response = await POST(buildRequest(new FormData()), {
      params: Promise.resolve({ id: "4", invitationId: "7" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/projects/4/members?error=Unable+to+revoke+invitation.",
    )
  })

  it("redirects with the thrown error message when revocation fails", async () => {
    vi.mocked(revokeProjectInvitation).mockRejectedValue(
      new Error("Revoke invitation failed"),
    )

    const formData = new FormData()
    formData.set("redirectTo", "/projects/4/members?project=4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4", invitationId: "7" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/projects/4/members?project=4&error=Revoke+invitation+failed",
    )
  })
})
