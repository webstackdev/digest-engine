import { beforeEach, describe, expect, it, vi } from "vitest"

import { createProjectIntakeAllowlistEntry } from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  createProjectIntakeAllowlistEntry: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/intake-allowlist", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects/[id]/intake-allowlist", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates an allowlist entry and redirects with a success message", async () => {
    vi.mocked(createProjectIntakeAllowlistEntry).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("redirectTo", "/admin/sources?project=4")
    formData.set("senderEmail", "sender@example.com")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(createProjectIntakeAllowlistEntry).toHaveBeenCalledWith(
      4,
      "sender@example.com",
    )
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&message=Sender+added+to+intake+allowlist.",
    )
  })

  it("redirects with the thrown error message when creation fails", async () => {
    vi.mocked(createProjectIntakeAllowlistEntry).mockRejectedValue(
      new Error("Create allowlist failed"),
    )

    const formData = new FormData()
    formData.set("redirectTo", "/admin/sources?project=4")
    formData.set("senderEmail", "sender@example.com")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&error=Create+allowlist+failed",
    )
  })

  it("redirects with the fallback error when a non-Error value is thrown", async () => {
    vi.mocked(createProjectIntakeAllowlistEntry).mockRejectedValue("boom")

    const response = await POST(buildRequest(new FormData()), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?error=Unable+to+update+intake+allowlist.",
    )
  })
})
