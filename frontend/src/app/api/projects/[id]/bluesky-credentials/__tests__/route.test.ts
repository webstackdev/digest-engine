import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createProjectBlueskyCredentials,
  updateProjectBlueskyCredentials,
} from "@/lib/api"

import { POST } from "../route"

vi.mock("@/lib/api", () => ({
  createProjectBlueskyCredentials: vi.fn(),
  updateProjectBlueskyCredentials: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/bluesky-credentials", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects/[id]/bluesky-credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates credentials and redirects with a success message", async () => {
    vi.mocked(createProjectBlueskyCredentials).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("redirectTo", "/admin/sources?project=4")
    formData.set("handle", "project.bsky.social")
    formData.set("pds_url", "")
    formData.set("is_active", "true")
    formData.set("app_password", "app-password")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(createProjectBlueskyCredentials).toHaveBeenCalledWith(4, {
      handle: "project.bsky.social",
      pds_url: "",
      is_active: true,
      app_password: "app-password",
    })
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&message=Bluesky+credentials+saved.",
    )
  })

  it("updates credentials and redirects with a success message", async () => {
    vi.mocked(updateProjectBlueskyCredentials).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("redirectTo", "/admin/sources?project=4")
    formData.set("credentialId", "9")
    formData.set("handle", "project.bsky.social")
    formData.set("pds_url", "https://pds.example.com")
    formData.set("is_active", "false")
    formData.set("app_password", "")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(updateProjectBlueskyCredentials).toHaveBeenCalledWith(4, 9, {
      handle: "project.bsky.social",
      pds_url: "https://pds.example.com",
      is_active: false,
      app_password: "",
    })
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&message=Bluesky+credentials+updated.",
    )
  })
})