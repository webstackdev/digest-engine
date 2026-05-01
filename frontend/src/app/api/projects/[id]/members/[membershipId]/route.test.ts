import { beforeEach, describe, expect, it, vi } from "vitest"

import { deleteProjectMembership, updateProjectMembership } from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  deleteProjectMembership: vi.fn(),
  updateProjectMembership: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/members/7", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects/[id]/members/[membershipId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates a membership role and redirects with a success message", async () => {
    vi.mocked(updateProjectMembership).mockResolvedValue({
      id: 7,
      project: 4,
      user: 2,
      username: "member",
      email: "member@example.com",
      display_name: "Member",
      role: "reader",
      invited_by: null,
      joined_at: "2026-04-30T00:00:00Z",
    })

    const formData = new FormData()
    formData.set("redirectTo", "/projects/4/members?project=4")
    formData.set("role", "reader")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4", membershipId: "7" }),
    })

    expect(updateProjectMembership).toHaveBeenCalledWith(4, 7, { role: "reader" })
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/projects/4/members?project=4&message=Role+updated.",
    )
  })

  it("removes a membership and redirects with a success message", async () => {
    vi.mocked(deleteProjectMembership).mockResolvedValue(undefined)

    const formData = new FormData()
    formData.set("redirectTo", "/projects/4/members?project=4")
    formData.set("intent", "remove")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4", membershipId: "7" }),
    })

    expect(deleteProjectMembership).toHaveBeenCalledWith(4, 7)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/projects/4/members?project=4&message=Member+removed.",
    )
  })

  it("redirects with the thrown error message when updating a role fails", async () => {
    vi.mocked(updateProjectMembership).mockRejectedValue(
      new Error("Update membership failed"),
    )

    const formData = new FormData()
    formData.set("redirectTo", "/projects/4/members?project=4")
    formData.set("role", "reader")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4", membershipId: "7" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/projects/4/members?project=4&error=Update+membership+failed",
    )
  })

  it("redirects with the fallback error when a non-Error value is thrown", async () => {
    vi.mocked(deleteProjectMembership).mockRejectedValue("boom")

    const formData = new FormData()
    formData.set("intent", "remove")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4", membershipId: "7" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/projects/4/members?error=Unable+to+update+membership.",
    )
  })
})
