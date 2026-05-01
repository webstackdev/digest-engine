import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  getCurrentUserProfile,
  updateCurrentUserProfile,
} from "@/lib/api"

import { GET, PATCH } from "../route"

vi.mock("@/lib/api", () => ({
  getCurrentUserProfile: vi.fn(),
  updateCurrentUserProfile: vi.fn(),
}))

describe("/api/profile route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the current profile payload", async () => {
    vi.mocked(getCurrentUserProfile).mockResolvedValue({
      id: 3,
      username: "editor",
      email: "editor@example.com",
      display_name: "Editor",
      avatar_url: null,
      avatar_thumbnail_url: null,
      bio: "Writes",
      timezone: "UTC",
      first_name: "",
      last_name: "",
    })

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ username: "editor" })
  })

  it("updates editable profile fields", async () => {
    vi.mocked(updateCurrentUserProfile).mockResolvedValue({
      id: 3,
      username: "editor",
      email: "editor@example.com",
      display_name: "Updated Editor",
      avatar_url: null,
      avatar_thumbnail_url: null,
      bio: "Writes",
      timezone: "America/New_York",
      first_name: "",
      last_name: "",
    })

    const response = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: "Updated Editor",
          timezone: "America/New_York",
        }),
      }),
    )

    expect(updateCurrentUserProfile).toHaveBeenCalledWith({
      display_name: "Updated Editor",
      timezone: "America/New_York",
    })
    expect(response.status).toBe(200)
  })

  it("returns the thrown error message when loading the profile fails", async () => {
    vi.mocked(getCurrentUserProfile).mockRejectedValue(
      new Error("Load profile failed"),
    )

    const response = await GET()

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Load profile failed",
    })
  })

  it("returns the fallback load error for non-Error failures", async () => {
    vi.mocked(getCurrentUserProfile).mockRejectedValue("boom")

    const response = await GET()

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Unable to load profile.",
    })
  })

  it("returns the thrown error message when saving the profile fails", async () => {
    vi.mocked(updateCurrentUserProfile).mockRejectedValue(
      new Error("Save profile failed"),
    )

    const response = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: "Updated Editor" }),
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Save profile failed",
    })
  })

  it("returns the fallback save error for non-Error failures", async () => {
    vi.mocked(updateCurrentUserProfile).mockRejectedValue("boom")

    const response = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: "Updated Editor" }),
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Unable to save profile.",
    })
  })
})
