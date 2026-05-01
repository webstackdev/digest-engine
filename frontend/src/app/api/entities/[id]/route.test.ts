import { beforeEach, describe, expect, it, vi } from "vitest"

import { deleteEntity, updateEntity } from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  deleteEntity: vi.fn(),
  updateEntity: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/entities/9", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/entities/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates an entity and redirects with a success message", async () => {
    vi.mocked(updateEntity).mockResolvedValue(undefined)

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

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "9" }),
    })

    expect(updateEntity).toHaveBeenCalledWith(9, 4, {
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
      "http://localhost/entities?project=4&message=Entity+updated.",
    )
  })

  it("deletes an entity when intent=delete and redirects with a success message", async () => {
    vi.mocked(deleteEntity).mockResolvedValue(undefined)

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("redirectTo", "/entities?project=4")
    formData.set("intent", "delete")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "9" }),
    })

    expect(deleteEntity).toHaveBeenCalledWith(9, 4)
    expect(updateEntity).not.toHaveBeenCalled()
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/entities?project=4&message=Entity+deleted.",
    )
  })

  it("redirects with the thrown error message when the API helper fails", async () => {
    vi.mocked(updateEntity).mockRejectedValue(new Error("Save failed"))

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("redirectTo", "/entities?project=4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "9" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/entities?project=4&error=Save+failed",
    )
  })

  it("redirects with a fallback error when a non-Error value is thrown", async () => {
    vi.mocked(updateEntity).mockRejectedValue("boom")

    const formData = new FormData()
    formData.set("projectId", "4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "9" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/entities?error=Unable+to+save+entity.",
    )
  })
})
