import { beforeEach, describe, expect, it, vi } from "vitest"

import { deleteCurrentUserAvatar, uploadCurrentUserAvatar } from "@/lib/api"

import { DELETE, POST } from "./route"

vi.mock("@/lib/api", () => ({
  deleteCurrentUserAvatar: vi.fn(),
  uploadCurrentUserAvatar: vi.fn(),
}))

describe("/api/profile/avatar route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uploads a new avatar image", async () => {
    vi.mocked(uploadCurrentUserAvatar).mockResolvedValue({
      id: 5,
      username: "editor",
      email: "editor@example.com",
      display_name: "Editor",
      avatar_url: "/media/avatars/5/avatar.png",
      avatar_thumbnail_url: "/media/avatars/5/thumb.webp",
      bio: "Writes",
      timezone: "UTC",
      first_name: "",
      last_name: "",
    })

    const formData = new FormData()
    formData.set(
      "avatar",
      new File(["avatar"], "avatar.png", { type: "image/png" }),
    )

    const request = {
      formData: vi.fn().mockResolvedValue(formData),
    } as unknown as Request

    const response = await POST(request)

    expect(uploadCurrentUserAvatar).toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it("returns a validation error when no avatar file is provided", async () => {
    const formData = new FormData()

    const request = {
      formData: vi.fn().mockResolvedValue(formData),
    } as unknown as Request

    const response = await POST(request)

    expect(uploadCurrentUserAvatar).not.toHaveBeenCalled()
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Select an avatar image to upload.",
    })
  })

  it("returns the thrown upload error message", async () => {
    vi.mocked(uploadCurrentUserAvatar).mockRejectedValue(
      new Error("Upload avatar failed"),
    )

    const formData = new FormData()
    formData.set(
      "avatar",
      new File(["avatar"], "avatar.png", { type: "image/png" }),
    )

    const request = {
      formData: vi.fn().mockResolvedValue(formData),
    } as unknown as Request

    const response = await POST(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Upload avatar failed",
    })
  })

  it("returns the fallback upload error for non-Error failures", async () => {
    vi.mocked(uploadCurrentUserAvatar).mockRejectedValue("boom")

    const formData = new FormData()
    formData.set(
      "avatar",
      new File(["avatar"], "avatar.png", { type: "image/png" }),
    )

    const request = {
      formData: vi.fn().mockResolvedValue(formData),
    } as unknown as Request

    const response = await POST(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Unable to upload avatar.",
    })
  })

  it("deletes the current avatar image", async () => {
    vi.mocked(deleteCurrentUserAvatar).mockResolvedValue({
      id: 5,
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

    const response = await DELETE()

    expect(deleteCurrentUserAvatar).toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it("returns the thrown delete error message", async () => {
    vi.mocked(deleteCurrentUserAvatar).mockRejectedValue(
      new Error("Delete avatar failed"),
    )

    const response = await DELETE()

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Delete avatar failed",
    })
  })

  it("returns the fallback delete error for non-Error failures", async () => {
    vi.mocked(deleteCurrentUserAvatar).mockRejectedValue("boom")

    const response = await DELETE()

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Unable to remove avatar.",
    })
  })
})
