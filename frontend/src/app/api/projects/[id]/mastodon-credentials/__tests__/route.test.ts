import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createProjectMastodonCredentials,
  updateProjectMastodonCredentials,
} from "@/lib/api"

import { POST } from "../route"

vi.mock("@/lib/api", () => ({
  createProjectMastodonCredentials: vi.fn(),
  updateProjectMastodonCredentials: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/mastodon-credentials", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects/[id]/mastodon-credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates credentials and redirects with a success message", async () => {
    vi.mocked(createProjectMastodonCredentials).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("redirectTo", "/admin/sources?project=4")
    formData.set("instance_url", "https://hachyderm.io")
    formData.set("account_acct", "alice@hachyderm.io")
    formData.set("is_active", "true")
    formData.set("access_token", "access-token")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(createProjectMastodonCredentials).toHaveBeenCalledWith(4, {
      instance_url: "https://hachyderm.io",
      account_acct: "alice@hachyderm.io",
      is_active: true,
      access_token: "access-token",
    })
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&message=Mastodon+credentials+saved.",
    )
  })

  it("updates credentials and redirects with a success message", async () => {
    vi.mocked(updateProjectMastodonCredentials).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("redirectTo", "/admin/sources?project=4")
    formData.set("credentialId", "9")
    formData.set("instance_url", "https://hachyderm.io")
    formData.set("account_acct", "alice@hachyderm.io")
    formData.set("is_active", "false")
    formData.set("access_token", "")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(updateProjectMastodonCredentials).toHaveBeenCalledWith(4, 9, {
      instance_url: "https://hachyderm.io",
      account_acct: "alice@hachyderm.io",
      is_active: false,
      access_token: "",
    })
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/sources?project=4&message=Mastodon+credentials+updated.",
    )
  })
})
