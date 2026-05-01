import { beforeEach, describe, expect, it, vi } from "vitest"

import { createProject } from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  createProject: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a project and redirects to the members page", async () => {
    vi.mocked(createProject).mockResolvedValue({
      id: 11,
      name: "New Project",
      topic_description: "A new project",
      content_retention_days: 180,
      intake_enabled: false,
      user_role: "admin",
      created_at: "2026-04-30T00:00:00Z",
    })

    const formData = new FormData()
    formData.set("name", "New Project")
    formData.set("topic_description", "A new project")
    formData.set("content_retention_days", "180")

    const response = await POST(buildRequest(formData))

    expect(createProject).toHaveBeenCalledWith({
      name: "New Project",
      topic_description: "A new project",
      content_retention_days: 180,
    })
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/projects/11/members?project=11&message=Created+New+Project.",
    )
  })

  it("defaults invalid retention days to 365", async () => {
    vi.mocked(createProject).mockResolvedValue({
      id: 11,
      name: "New Project",
      topic_description: "A new project",
      content_retention_days: 365,
      intake_enabled: false,
      user_role: "admin",
      created_at: "2026-04-30T00:00:00Z",
    })

    const formData = new FormData()
    formData.set("name", "New Project")
    formData.set("topic_description", "A new project")
    formData.set("content_retention_days", "not-a-number")

    await POST(buildRequest(formData))

    expect(createProject).toHaveBeenCalledWith({
      name: "New Project",
      topic_description: "A new project",
      content_retention_days: 365,
    })
  })

  it("redirects with the fallback error when a non-Error value is thrown", async () => {
    vi.mocked(createProject).mockRejectedValue("boom")

    const response = await POST(buildRequest(new FormData()))

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/projects/new?error=Unable+to+create+project.",
    )
  })

  it("redirects with the thrown error message when project creation fails", async () => {
    vi.mocked(createProject).mockRejectedValue(new Error("Create project failed"))

    const formData = new FormData()
    formData.set("redirectTo", "/admin/projects/new")

    const response = await POST(buildRequest(formData))

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/admin/projects/new?error=Create+project+failed",
    )
  })
})
