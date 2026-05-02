import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  generateProjectNewsletterDraft,
  isCompletedNewsletterDraftGeneration,
} from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  generateProjectNewsletterDraft: vi.fn(),
  isCompletedNewsletterDraftGeneration: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/drafts/generate", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("POST /api/projects/[id]/drafts/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isCompletedNewsletterDraftGeneration).mockImplementation(
      (response) => response.status === "completed",
    )
  })

  it("redirects with a success message when a draft is generated immediately", async () => {
    vi.mocked(generateProjectNewsletterDraft).mockResolvedValue({
      status: "completed",
      project_id: 4,
      result: {
        project_id: 4,
        draft_id: 9,
        status: "ready",
        sections_created: 2,
        original_pieces_created: 1,
      },
    })

    const formData = new FormData()
    formData.set("redirectTo", "/drafts?project=4&status=ready")

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(generateProjectNewsletterDraft).toHaveBeenCalledWith(4)
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/drafts?project=4&status=ready&message=Newsletter+draft+generated.",
    )
  })

  it("redirects with an informative no-op message when inputs are insufficient", async () => {
    vi.mocked(generateProjectNewsletterDraft).mockResolvedValue({
      status: "completed",
      project_id: 4,
      result: {
        project_id: 4,
        draft_id: null,
        status: "skipped",
        reason: "insufficient_inputs",
        sections_created: 0,
        original_pieces_created: 0,
      },
    })

    const response = await POST(buildRequest(new FormData()), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/drafts?project=4&message=No+newsletter+draft+was+created+because+the+project+needs+at+least+two+accepted+themes+and+one+accepted+original+idea.",
    )
  })

  it("redirects with a queued message when generation is deferred", async () => {
    vi.mocked(generateProjectNewsletterDraft).mockResolvedValue({
      status: "queued",
      project_id: 4,
    })

    const response = await POST(buildRequest(new FormData()), {
      params: Promise.resolve({ id: "4" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/drafts?project=4&message=Newsletter+draft+generation+queued.",
    )
  })
})