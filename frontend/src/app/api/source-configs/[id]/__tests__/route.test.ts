import { beforeEach, describe, expect, it, vi } from "vitest"

import { updateSourceConfig } from "@/lib/api"

import { POST } from "../route"

vi.mock("@/lib/api", () => ({
  updateSourceConfig: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/source-configs/5", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/source-configs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates a source config and redirects with a success message", async () => {
    vi.mocked(updateSourceConfig).mockResolvedValue(undefined)

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("redirectTo", "/admin/sources?project=4")
    formData.set("is_active", "false")
    formData.set("config_json", '{"feed_url":"https://example.com/feed.xml"}')

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "5" }),
    })

    expect(updateSourceConfig).toHaveBeenCalledWith(5, 4, {
      is_active: false,
      config: { feed_url: "https://example.com/feed.xml" },
    })
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&message=Source+updated.",
    )
  })

  it("defaults missing config_json to an empty object and is_active to true", async () => {
    vi.mocked(updateSourceConfig).mockResolvedValue(undefined)

    const formData = new FormData()
    formData.set("projectId", "4")

    await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "5" }),
    })

    expect(updateSourceConfig).toHaveBeenCalledWith(5, 4, {
      is_active: true,
      config: {},
    })
  })

  it("redirects with the JSON parse error message when config_json is invalid", async () => {
    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("redirectTo", "/admin/sources?project=4")
    formData.set("config_json", "{invalid json")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "5" }),
    })

    expect(updateSourceConfig).not.toHaveBeenCalled()
    expect(response.status).toBe(307)
    expect(await getLocation(response)).toContain("error=")
  })

  it("redirects with the thrown error message when the API helper fails", async () => {
    vi.mocked(updateSourceConfig).mockRejectedValue(new Error("Update failed"))

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("redirectTo", "/admin/sources?project=4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "5" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&error=Update+failed",
    )
  })

  it("redirects with a fallback error when a non-Error value is thrown", async () => {
    vi.mocked(updateSourceConfig).mockRejectedValue("boom")

    const formData = new FormData()
    formData.set("projectId", "4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "5" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?error=Unable+to+update+source+configuration.",
    )
  })
})
