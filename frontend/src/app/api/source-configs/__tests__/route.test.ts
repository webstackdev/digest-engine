import { beforeEach, describe, expect, it, vi } from "vitest"

import { createSourceConfig } from "@/lib/api"

import { POST } from "../route"

vi.mock("@/lib/api", () => ({
  createSourceConfig: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/source-configs", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/source-configs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a source config and redirects with a success message", async () => {
    vi.mocked(createSourceConfig).mockResolvedValue(undefined)

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("redirectTo", "/admin/sources?project=4")
    formData.set("plugin_name", "rss")
    formData.set("is_active", "false")
    formData.set("config_json", '{"feed_url":"https://example.com/feed.xml"}')

    const response = await POST(buildRequest(formData))

    expect(createSourceConfig).toHaveBeenCalledWith(4, {
      plugin_name: "rss",
      config: { feed_url: "https://example.com/feed.xml" },
      is_active: false,
    })
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&message=Source+created.",
    )
  })

  it("defaults missing config_json to an empty object and is_active to true", async () => {
    vi.mocked(createSourceConfig).mockResolvedValue(undefined)

    const formData = new FormData()
    formData.set("projectId", "4")

    await POST(buildRequest(formData))

    expect(createSourceConfig).toHaveBeenCalledWith(4, {
      plugin_name: "rss",
      config: {},
      is_active: true,
    })
  })

  it("redirects with the JSON parse error message when config_json is invalid", async () => {
    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("redirectTo", "/admin/sources?project=4")
    formData.set("config_json", "{invalid json")

    const response = await POST(buildRequest(formData))

    expect(createSourceConfig).not.toHaveBeenCalled()
    expect(response.status).toBe(307)
    expect(await getLocation(response)).toContain("error=")
  })

  it("redirects with the thrown error message when the API helper fails", async () => {
    vi.mocked(createSourceConfig).mockRejectedValue(new Error("Create failed"))

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("redirectTo", "/admin/sources?project=4")

    const response = await POST(buildRequest(formData))

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&error=Create+failed",
    )
  })

  it("redirects with a fallback error when a non-Error value is thrown", async () => {
    vi.mocked(createSourceConfig).mockRejectedValue("boom")

    const formData = new FormData()
    formData.set("projectId", "4")

    const response = await POST(buildRequest(formData))

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?error=Unable+to+create+source+configuration.",
    )
  })
})
