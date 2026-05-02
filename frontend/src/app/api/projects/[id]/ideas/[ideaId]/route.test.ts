import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  acceptProjectOriginalContentIdea,
  dismissProjectOriginalContentIdea,
  markProjectOriginalContentIdeaWritten,
} from "@/lib/api"

import { POST as acceptIdea } from "./accept/route"
import { POST as dismissIdea } from "./dismiss/route"
import { POST as markIdeaWritten } from "./mark-written/route"

vi.mock("@/lib/api", () => ({
  acceptProjectOriginalContentIdea: vi.fn(),
  dismissProjectOriginalContentIdea: vi.fn(),
  markProjectOriginalContentIdeaWritten: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/ideas/6/action", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("idea mutation route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("accepts an idea and redirects with a success message", async () => {
    vi.mocked(acceptProjectOriginalContentIdea).mockResolvedValue(
      undefined as never,
    )

    const formData = new FormData()
    formData.set("redirectTo", "/ideas?project=4&status=pending")

    const response = await acceptIdea(buildRequest(formData), {
      params: Promise.resolve({ id: "4", ideaId: "6" }),
    })

    expect(acceptProjectOriginalContentIdea).toHaveBeenCalledWith(4, 6)
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/ideas?project=4&status=pending&message=Original+content+idea+accepted.",
    )
  })

  it("uses the fallback accept error when a non-Error value is thrown", async () => {
    vi.mocked(acceptProjectOriginalContentIdea).mockRejectedValue("boom")

    const response = await acceptIdea(buildRequest(new FormData()), {
      params: Promise.resolve({ id: "4", ideaId: "6" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/ideas?project=4&error=Unable+to+accept+original+content+idea.",
    )
  })

  it("dismisses an idea with the provided reason and default redirect", async () => {
    vi.mocked(dismissProjectOriginalContentIdea).mockResolvedValue(
      undefined as never,
    )

    const formData = new FormData()
    formData.set("reason", "Too close to the current issue")

    const response = await dismissIdea(buildRequest(formData), {
      params: Promise.resolve({ id: "4", ideaId: "6" }),
    })

    expect(dismissProjectOriginalContentIdea).toHaveBeenCalledWith(
      4,
      6,
      "Too close to the current issue",
    )
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/ideas?project=4&message=Original+content+idea+dismissed.",
    )
  })

  it("redirects with the thrown dismissal error message", async () => {
    vi.mocked(dismissProjectOriginalContentIdea).mockRejectedValue(
      new Error("Dismiss idea failed"),
    )

    const formData = new FormData()
    formData.set("redirectTo", "/ideas?project=4&status=pending")

    const response = await dismissIdea(buildRequest(formData), {
      params: Promise.resolve({ id: "4", ideaId: "6" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/ideas?project=4&status=pending&error=Dismiss+idea+failed",
    )
  })

  it("marks an idea written and redirects with a success message", async () => {
    vi.mocked(markProjectOriginalContentIdeaWritten).mockResolvedValue(
      undefined as never,
    )

    const response = await markIdeaWritten(buildRequest(new FormData()), {
      params: Promise.resolve({ id: "4", ideaId: "6" }),
    })

    expect(markProjectOriginalContentIdeaWritten).toHaveBeenCalledWith(4, 6)
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/ideas?project=4&message=Original+content+idea+marked+written.",
    )
  })

  it("redirects with the thrown mark-written error message", async () => {
    vi.mocked(markProjectOriginalContentIdeaWritten).mockRejectedValue(
      new Error("Mark written failed"),
    )

    const formData = new FormData()
    formData.set("redirectTo", "/ideas?project=4&status=accepted")

    const response = await markIdeaWritten(buildRequest(formData), {
      params: Promise.resolve({ id: "4", ideaId: "6" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/ideas?project=4&status=accepted&error=Mark+written+failed",
    )
  })
})
