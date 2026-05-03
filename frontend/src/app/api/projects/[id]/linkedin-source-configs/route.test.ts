import { beforeEach, describe, expect, it, vi } from "vitest"

import { createSourceConfig } from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  createSourceConfig: vi.fn(),
}))

describe("POST /api/projects/[id]/linkedin-source-configs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates an organization LinkedIn source", async () => {
    const formData = new FormData()
    formData.set("surface", "organization")
    formData.set("urn", "urn:li:organization:1337")
    formData.set("max_posts_per_fetch", "75")
    formData.set("redirectTo", "/admin/sources?project=4")

    const response = await POST(
      new Request("http://localhost/api/projects/4/linkedin-source-configs", {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ id: "4" }) },
    )

    expect(createSourceConfig).toHaveBeenCalledWith(4, {
      plugin_name: "linkedin",
      config: {
        organization_urn: "urn:li:organization:1337",
        max_posts_per_fetch: 75,
      },
      is_active: true,
    })
    expect(response.headers.get("location")).toBe(
      "http://localhost/admin/sources?project=4&message=LinkedIn+source+created.",
    )
  })

  it("creates a person LinkedIn source with reshare choice", async () => {
    const formData = new FormData()
    formData.set("surface", "person")
    formData.set("urn", "urn:li:person:abc123")
    formData.set("include_reshares", "true")

    await POST(
      new Request("http://localhost/api/projects/4/linkedin-source-configs", {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ id: "4" }) },
    )

    expect(createSourceConfig).toHaveBeenCalledWith(4, {
      plugin_name: "linkedin",
      config: {
        person_urn: "urn:li:person:abc123",
        include_reshares: true,
      },
      is_active: true,
    })
  })
})
