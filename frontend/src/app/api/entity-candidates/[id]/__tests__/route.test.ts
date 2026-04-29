import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  acceptEntityCandidate,
  mergeEntityCandidate,
  rejectEntityCandidate,
} from "@/lib/api"
import type { EntityCandidate } from "@/lib/types"

import { POST } from "../route"

vi.mock("@/lib/api", () => ({
  acceptEntityCandidate: vi.fn(),
  mergeEntityCandidate: vi.fn(),
  rejectEntityCandidate: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/entity-candidates/9", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

function createCandidate(overrides: Partial<EntityCandidate> = {}): EntityCandidate {
  return {
    id: 9,
    project: 4,
    name: "River Labs",
    suggested_type: "vendor",
    first_seen_in: 21,
    first_seen_title: "River Labs launches hosted platform",
    occurrence_count: 2,
    status: "pending",
    merged_into: null,
    merged_into_name: "",
    created_at: "2026-04-28T10:00:00Z",
    updated_at: "2026-04-28T11:00:00Z",
    ...overrides,
  }
}

describe("POST /api/entity-candidates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("accepts a candidate and redirects with a success message", async () => {
    vi.mocked(acceptEntityCandidate).mockResolvedValue(createCandidate())

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("redirectTo", "/entities?project=4")
    formData.set("intent", "accept")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "9" }),
    })

    expect(acceptEntityCandidate).toHaveBeenCalledWith(9, 4)
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/entities?project=4&message=Candidate+accepted.",
    )
  })

  it("rejects a candidate and redirects with a success message", async () => {
    vi.mocked(rejectEntityCandidate).mockResolvedValue(
      createCandidate({ status: "rejected" }),
    )

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("redirectTo", "/entities?project=4")
    formData.set("intent", "reject")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "9" }),
    })

    expect(rejectEntityCandidate).toHaveBeenCalledWith(9, 4)
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/entities?project=4&message=Candidate+rejected.",
    )
  })

  it("merges a candidate and redirects with a success message", async () => {
    vi.mocked(mergeEntityCandidate).mockResolvedValue(
      createCandidate({ status: "merged", merged_into: 15, merged_into_name: "Acme" }),
    )

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("redirectTo", "/entities?project=4")
    formData.set("intent", "merge")
    formData.set("mergedInto", "15")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "9" }),
    })

    expect(mergeEntityCandidate).toHaveBeenCalledWith(9, 4, 15)
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/entities?project=4&message=Candidate+merged.",
    )
  })

  it("redirects with a validation error when merge target is missing", async () => {
    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("redirectTo", "/entities?project=4")
    formData.set("intent", "merge")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "9" }),
    })

    expect(mergeEntityCandidate).not.toHaveBeenCalled()
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/entities?project=4&error=Select+an+entity+to+merge+into.",
    )
  })

  it("redirects with a fallback error when the helper throws a non-Error value", async () => {
    vi.mocked(acceptEntityCandidate).mockRejectedValue("boom")

    const formData = new FormData()
    formData.set("projectId", "4")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "9" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/entities?error=Unable+to+update+entity+candidate.",
    )
  })
})
