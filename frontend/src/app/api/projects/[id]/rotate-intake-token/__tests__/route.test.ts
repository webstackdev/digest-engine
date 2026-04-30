import { beforeEach, describe, expect, it, vi } from "vitest"

import { rotateProjectIntakeToken } from "@/lib/api"

import { POST } from "../route"

vi.mock("@/lib/api", () => ({
  rotateProjectIntakeToken: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/rotate-intake-token", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects/[id]/rotate-intake-token", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rotates the token and redirects with a success message", async () => {
    vi.mocked(rotateProjectIntakeToken).mockResolvedValue({
      id: 4,
      name: "Project",
      topic_description: "Topic",
      content_retention_days: 30,
      intake_token: "rotated-token",
      intake_enabled: true,
      user_role: "admin",
      created_at: "2026-04-30T00:00:00Z",
    })

    const formData = new FormData()
    formData.set("redirectTo", "/admin/sources?project=4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(rotateProjectIntakeToken).toHaveBeenCalledWith(4)
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&message=Rotated+intake+token+to+rotated-token.",
    )
  })
})
