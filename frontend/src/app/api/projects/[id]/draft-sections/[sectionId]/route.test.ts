import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  deleteProjectNewsletterDraftSection,
  updateProjectNewsletterDraftSection,
} from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  deleteProjectNewsletterDraftSection: vi.fn(),
  updateProjectNewsletterDraftSection: vi.fn(),
}))

describe("POST /api/projects/[id]/draft-sections/[sectionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns JSON for section updates", async () => {
    vi.mocked(updateProjectNewsletterDraftSection).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("title", "Updated title")
    formData.set("lede", "Updated lede")

    const response = await POST(
      new Request("http://localhost/api/projects/4/draft-sections/12?mode=json", {
        method: "POST",
        body: formData,
      }),
      {
        params: Promise.resolve({ id: "4", sectionId: "12" }),
      },
    )

    expect(updateProjectNewsletterDraftSection).toHaveBeenCalledWith(12, 4, {
      title: "Updated title",
      lede: "Updated lede",
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: "Section updated." })
  })

  it("swaps section order when moving a section", async () => {
    vi.mocked(updateProjectNewsletterDraftSection).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("intent", "move_up")
    formData.set("currentOrder", "2")
    formData.set("targetOrder", "1")
    formData.set("swapWithId", "11")

    const response = await POST(
      new Request("http://localhost/api/projects/4/draft-sections/12?mode=json", {
        method: "POST",
        body: formData,
      }),
      {
        params: Promise.resolve({ id: "4", sectionId: "12" }),
      },
    )

    expect(updateProjectNewsletterDraftSection).toHaveBeenNthCalledWith(1, 12, 4, {
      order: -1,
    })
    expect(updateProjectNewsletterDraftSection).toHaveBeenNthCalledWith(2, 11, 4, {
      order: 2,
    })
    expect(updateProjectNewsletterDraftSection).toHaveBeenNthCalledWith(3, 12, 4, {
      order: 1,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: "Section moved up." })
  })

  it("deletes a section when requested", async () => {
    vi.mocked(deleteProjectNewsletterDraftSection).mockResolvedValue(undefined)

    const formData = new FormData()
    formData.set("intent", "delete")

    const response = await POST(
      new Request("http://localhost/api/projects/4/draft-sections/12?mode=json", {
        method: "POST",
        body: formData,
      }),
      {
        params: Promise.resolve({ id: "4", sectionId: "12" }),
      },
    )

    expect(deleteProjectNewsletterDraftSection).toHaveBeenCalledWith(12, 4)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: "Section removed." })
  })
})
