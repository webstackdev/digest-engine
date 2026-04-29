import { beforeEach, describe, expect, it, vi } from "vitest"

import { updateProject } from "@/lib/api"

import { POST } from "../route"

vi.mock("@/lib/api", () => ({
  updateProject: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/intake", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects/[id]/intake", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates intake settings and redirects with a success message", async () => {
    vi.mocked(updateProject).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("redirectTo", "/admin/sources?project=4")
    formData.set("intake_enabled", "true")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(updateProject).toHaveBeenCalledWith(4, { intake_enabled: true })
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&message=Newsletter+intake+settings+updated.",
    )
  })

  it("defaults the intake toggle to false when omitted", async () => {
    vi.mocked(updateProject).mockResolvedValue(undefined as never)

    await POST(buildRequest(new FormData()), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(updateProject).toHaveBeenCalledWith(4, { intake_enabled: false })
  })

  it("redirects with the thrown error message when the API helper fails", async () => {
    vi.mocked(updateProject).mockRejectedValue(
      new Error("Update intake failed"),
    )

    const formData = new FormData()
    formData.set("redirectTo", "/admin/sources?project=4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&error=Update+intake+failed",
    )
  })

  it("redirects with a fallback error when a non-Error value is thrown", async () => {
    vi.mocked(updateProject).mockRejectedValue("boom")

    const response = await POST(buildRequest(new FormData()), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?error=Unable+to+update+newsletter+intake+settings.",
    )
  })
})
