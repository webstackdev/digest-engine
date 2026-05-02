import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  acceptEntityCandidate,
  mergeEntityCandidate,
  rejectEntityCandidate,
} from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  acceptEntityCandidate: vi.fn(),
  mergeEntityCandidate: vi.fn(),
  rejectEntityCandidate: vi.fn(),
}))

describe("POST /api/projects/[id]/entity-candidate-bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("accepts all candidates in the submitted cluster", async () => {
    const formData = new FormData()
    formData.append("candidateId", "14")
    formData.append("candidateId", "15")
    formData.set("redirectTo", "/entities/candidates?project=4")

    const response = await POST(
      new Request("http://localhost/api/projects/4/entity-candidate-bulk", {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ id: "4" }) },
    )

    expect(acceptEntityCandidate).toHaveBeenNthCalledWith(1, 14, 4)
    expect(acceptEntityCandidate).toHaveBeenNthCalledWith(2, 15, 4)
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "http://localhost/entities/candidates?project=4&message=Accepted+2+candidates.",
    )
  })

  it("rejects all candidates in the submitted cluster", async () => {
    const formData = new FormData()
    formData.append("candidateId", "14")
    formData.set("intent", "reject")

    const response = await POST(
      new Request("http://localhost/api/projects/4/entity-candidate-bulk", {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ id: "4" }) },
    )

    expect(rejectEntityCandidate).toHaveBeenCalledWith(14, 4)
    expect(response.headers.get("location")).toBe(
      "http://localhost/entities/candidates?project=4&message=Rejected+1+candidate.",
    )
  })

  it("merges all candidates into the selected entity", async () => {
    const formData = new FormData()
    formData.append("candidateId", "14")
    formData.append("candidateId", "15")
    formData.set("intent", "merge")
    formData.set("mergedInto", "9")

    const response = await POST(
      new Request("http://localhost/api/projects/4/entity-candidate-bulk", {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ id: "4" }) },
    )

    expect(mergeEntityCandidate).toHaveBeenNthCalledWith(1, 14, 4, 9)
    expect(mergeEntityCandidate).toHaveBeenNthCalledWith(2, 15, 4, 9)
    expect(response.headers.get("location")).toBe(
      "http://localhost/entities/candidates?project=4&message=Merged+2+candidates.",
    )
  })

  it("returns a validation error when merge target is missing", async () => {
    const formData = new FormData()
    formData.append("candidateId", "14")
    formData.set("intent", "merge")

    const response = await POST(
      new Request(
        "http://localhost/api/projects/4/entity-candidate-bulk?mode=json",
        {
          method: "POST",
          body: formData,
        },
      ),
      { params: Promise.resolve({ id: "4" }) },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: "Select an entity to merge into.",
    })
  })
})