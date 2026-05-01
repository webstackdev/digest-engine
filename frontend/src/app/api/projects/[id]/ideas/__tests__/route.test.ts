import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  generateProjectOriginalContentIdeas,
  isCompletedOriginalContentIdeaGeneration,
} from "@/lib/api"

import { POST } from "../generate/route"

vi.mock("@/lib/api", () => ({
  generateProjectOriginalContentIdeas: vi.fn(),
  isCompletedOriginalContentIdeaGeneration: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/ideas/generate", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects/[id]/ideas/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isCompletedOriginalContentIdeaGeneration).mockImplementation(
      (response) => response.status === "completed",
    )
  })

  it("redirects with a success message when new ideas are generated immediately", async () => {
    vi.mocked(generateProjectOriginalContentIdeas).mockResolvedValue({
      status: "completed",
      project_id: 4,
      result: {
        project_id: 4,
        clusters_considered: 3,
        created: 2,
        skipped: 1,
      },
    })

    const formData = new FormData()
    formData.set("redirectTo", "/ideas?project=4&status=pending")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(generateProjectOriginalContentIdeas).toHaveBeenCalledWith(4)
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/ideas?project=4&status=pending&message=Generated+2+original+content+ideas.",
    )
  })

  it("redirects with a no-op success message when generation completes without creating ideas", async () => {
    vi.mocked(generateProjectOriginalContentIdeas).mockResolvedValue({
      status: "completed",
      project_id: 4,
      result: {
        project_id: 4,
        clusters_considered: 2,
        created: 0,
        skipped: 2,
      },
    })

    const response = await POST(buildRequest(new FormData()), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/ideas?project=4&message=No+new+original+content+ideas+were+created.",
    )
  })

  it("redirects with a queued message when generation is deferred", async () => {
    vi.mocked(generateProjectOriginalContentIdeas).mockResolvedValue({
      status: "queued",
      project_id: 4,
    })

    const response = await POST(buildRequest(new FormData()), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/ideas?project=4&message=Original+content+idea+generation+queued.",
    )
  })

  it("redirects with the fallback error when a non-Error value is thrown", async () => {
    vi.mocked(generateProjectOriginalContentIdeas).mockRejectedValue("boom")

    const response = await POST(buildRequest(new FormData()), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/ideas?project=4&error=Unable+to+generate+original+content+ideas.",
    )
  })
})