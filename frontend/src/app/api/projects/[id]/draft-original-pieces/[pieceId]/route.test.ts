import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  deleteProjectNewsletterDraftOriginalPiece,
  updateProjectNewsletterDraftOriginalPiece,
} from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  deleteProjectNewsletterDraftOriginalPiece: vi.fn(),
  updateProjectNewsletterDraftOriginalPiece: vi.fn(),
}))

describe("POST /api/projects/[id]/draft-original-pieces/[pieceId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns JSON for original-piece updates", async () => {
    vi.mocked(updateProjectNewsletterDraftOriginalPiece).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("title", "Updated original piece")
    formData.set("pitch", "Updated pitch")
    formData.set("suggested_outline", "1. Updated outline")

    const response = await POST(
      new Request(
        "http://localhost/api/projects/4/draft-original-pieces/31?mode=json",
        {
          method: "POST",
          body: formData,
        },
      ),
      {
        params: Promise.resolve({ id: "4", pieceId: "31" }),
      },
    )

    expect(updateProjectNewsletterDraftOriginalPiece).toHaveBeenCalledWith(31, 4, {
      title: "Updated original piece",
      pitch: "Updated pitch",
      suggested_outline: "1. Updated outline",
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: "Original piece updated.",
    })
  })

  it("swaps original-piece order when moving a piece", async () => {
    vi.mocked(updateProjectNewsletterDraftOriginalPiece).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("intent", "move_down")
    formData.set("currentOrder", "0")
    formData.set("targetOrder", "1")
    formData.set("swapWithId", "32")

    const response = await POST(
      new Request(
        "http://localhost/api/projects/4/draft-original-pieces/31?mode=json",
        {
          method: "POST",
          body: formData,
        },
      ),
      {
        params: Promise.resolve({ id: "4", pieceId: "31" }),
      },
    )

    expect(updateProjectNewsletterDraftOriginalPiece).toHaveBeenNthCalledWith(1, 31, 4, {
      order: -1,
    })
    expect(updateProjectNewsletterDraftOriginalPiece).toHaveBeenNthCalledWith(2, 32, 4, {
      order: 0,
    })
    expect(updateProjectNewsletterDraftOriginalPiece).toHaveBeenNthCalledWith(3, 31, 4, {
      order: 1,
    })
    await expect(response.json()).resolves.toEqual({
      message: "Original piece moved down.",
    })
  })

  it("deletes an original piece when requested", async () => {
    vi.mocked(deleteProjectNewsletterDraftOriginalPiece).mockResolvedValue(undefined)

    const formData = new FormData()
    formData.set("intent", "delete")

    const response = await POST(
      new Request(
        "http://localhost/api/projects/4/draft-original-pieces/31?mode=json",
        {
          method: "POST",
          body: formData,
        },
      ),
      {
        params: Promise.resolve({ id: "4", pieceId: "31" }),
      },
    )

    expect(deleteProjectNewsletterDraftOriginalPiece).toHaveBeenCalledWith(31, 4)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: "Original piece removed.",
    })
  })
})
