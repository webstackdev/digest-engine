import { beforeEach, describe, expect, it, vi } from "vitest"

import { createProjectInvitation } from "@/lib/api"

import { POST } from "../route"

vi.mock("@/lib/api", () => ({
  createProjectInvitation: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/invitations", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects/[id]/invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates an invitation and redirects with a success message", async () => {
    vi.mocked(createProjectInvitation).mockResolvedValue({
      id: 3,
      project: 4,
      email: "invitee@example.com",
      role: "member",
      token: "abc123",
      invited_by: 1,
      invited_by_email: "admin@example.com",
      invite_url: "http://localhost:3000/invite/abc123",
      created_at: "2026-04-30T00:00:00Z",
      accepted_at: null,
      revoked_at: null,
    })

    const formData = new FormData()
    formData.set("redirectTo", "/projects/4/members/invite?project=4")
    formData.set("email", "invitee@example.com")
    formData.set("role", "member")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(createProjectInvitation).toHaveBeenCalledWith(4, {
      email: "invitee@example.com",
      role: "member",
    })
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/projects/4/members/invite?project=4&message=Invitation+sent.",
    )
  })
})
