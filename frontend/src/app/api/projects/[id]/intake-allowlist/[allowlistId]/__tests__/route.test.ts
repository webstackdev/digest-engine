import { beforeEach, describe, expect, it, vi } from "vitest"

import { deleteProjectIntakeAllowlistEntry } from "@/lib/api"

import { POST } from "../route"

vi.mock("@/lib/api", () => ({
  deleteProjectIntakeAllowlistEntry: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/intake-allowlist/9", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects/[id]/intake-allowlist/[allowlistId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deletes an allowlist entry and redirects with a success message", async () => {
    vi.mocked(deleteProjectIntakeAllowlistEntry).mockResolvedValue(undefined)

    const formData = new FormData()
    formData.set("redirectTo", "/admin/sources?project=4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4", allowlistId: "9" }),
    })

    expect(deleteProjectIntakeAllowlistEntry).toHaveBeenCalledWith(9, 4)
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&message=Sender+removed+from+intake+allowlist.",
    )
  })

  it("redirects with the thrown error message when deletion fails", async () => {
    vi.mocked(deleteProjectIntakeAllowlistEntry).mockRejectedValue(
      new Error("Delete allowlist failed"),
    )

    const formData = new FormData()
    formData.set("redirectTo", "/admin/sources?project=4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4", allowlistId: "9" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&error=Delete+allowlist+failed",
    )
  })
})