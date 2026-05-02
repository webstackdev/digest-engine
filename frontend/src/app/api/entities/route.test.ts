import { beforeEach, describe, expect, it, vi } from "vitest"

import { createEntity } from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  createEntity: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/entities", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/entities", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates an entity and redirects with a success message", async () => {
    vi.mocked(createEntity).mockResolvedValue(undefined)

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("redirectTo", "/entities?project=4")
    formData.set("name", "Example Vendor")
    formData.set("type", "vendor")
    formData.set("description", "")
    formData.set("website_url", "https://example.com")
    formData.set("github_url", "")
    formData.set("linkedin_url", "")
    formData.set("bluesky_handle", "")
    formData.set("mastodon_handle", "")
    formData.set("twitter_handle", "")

    const response = await POST(buildRequest(formData))

    expect(createEntity).toHaveBeenCalledWith(4, {
      name: "Example Vendor",
      type: "vendor",
      description: "",
      website_url: "https://example.com",
      github_url: "",
      linkedin_url: "",
      bluesky_handle: "",
      mastodon_handle: "",
      twitter_handle: "",
    })
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/entities?project=4&message=Entity+created.",
    )
  })

  it("redirects with the thrown error message when entity creation fails", async () => {
    vi.mocked(createEntity).mockRejectedValue(new Error("Create failed"))

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("redirectTo", "/entities?project=4")

    const response = await POST(buildRequest(formData))

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/entities?project=4&error=Create+failed",
    )
  })

  it("redirects with a fallback error when a non-Error value is thrown", async () => {
    vi.mocked(createEntity).mockRejectedValue("boom")

    const formData = new FormData()
    formData.set("projectId", "4")

    const response = await POST(buildRequest(formData))

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/entities?error=Unable+to+create+entity.",
    )
  })
})
