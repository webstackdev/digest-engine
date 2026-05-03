import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  deleteProjectNewsletterDraftItem,
  updateProjectNewsletterDraftItem,
} from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  deleteProjectNewsletterDraftItem: vi.fn(),
  updateProjectNewsletterDraftItem: vi.fn(),
}))

describe("POST /api/projects/[id]/draft-items/[itemId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns JSON for draft-item updates", async () => {
    vi.mocked(updateProjectNewsletterDraftItem).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("summary_used", "Updated summary")
    formData.set("why_it_matters", "Updated why")

    const response = await POST(
      new Request("http://localhost/api/projects/4/draft-items/44?mode=json", {
        method: "POST",
        body: formData,
      }),
      {
        params: Promise.resolve({ id: "4", itemId: "44" }),
      },
    )

    expect(updateProjectNewsletterDraftItem).toHaveBeenCalledWith(44, 4, {
      summary_used: "Updated summary",
      why_it_matters: "Updated why",
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: "Draft item updated." })
  })

  it("swaps item order when moving an item", async () => {
    vi.mocked(updateProjectNewsletterDraftItem).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("intent", "move_down")
    formData.set("currentOrder", "0")
    formData.set("targetOrder", "1")
    formData.set("swapWithId", "45")

    const response = await POST(
      new Request("http://localhost/api/projects/4/draft-items/44?mode=json", {
        method: "POST",
        body: formData,
      }),
      {
        params: Promise.resolve({ id: "4", itemId: "44" }),
      },
    )

    expect(updateProjectNewsletterDraftItem).toHaveBeenNthCalledWith(1, 44, 4, {
      order: -1,
    })
    expect(updateProjectNewsletterDraftItem).toHaveBeenNthCalledWith(2, 45, 4, {
      order: 0,
    })
    expect(updateProjectNewsletterDraftItem).toHaveBeenNthCalledWith(3, 44, 4, {
      order: 1,
    })
    await expect(response.json()).resolves.toEqual({
      message: "Draft item moved down.",
    })
  })

  it("deletes a draft item when requested", async () => {
    vi.mocked(deleteProjectNewsletterDraftItem).mockResolvedValue(undefined)

    const formData = new FormData()
    formData.set("intent", "delete")

    const response = await POST(
      new Request("http://localhost/api/projects/4/draft-items/44?mode=json", {
        method: "POST",
        body: formData,
      }),
      {
        params: Promise.resolve({ id: "4", itemId: "44" }),
      },
    )

    expect(deleteProjectNewsletterDraftItem).toHaveBeenCalledWith(44, 4)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: "Draft item removed." })
  })
})
