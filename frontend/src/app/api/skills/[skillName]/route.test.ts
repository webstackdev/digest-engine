import { beforeEach, describe, expect, it, vi } from "vitest"

import { runContentSkill } from "@/lib/api"
import type { SkillResult } from "@/lib/types"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  runContentSkill: vi.fn(),
}))

function buildRequest(url: string, formData: FormData) {
  return new Request(url, {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

function buildSkillResult(overrides: Partial<SkillResult>): SkillResult {
  return {
    id: 11,
    content: 9,
    project: 4,
    skill_name: "summarization",
    status: "completed",
    result_data: null,
    error_message: "",
    model_used: "test-model",
    latency_ms: 120,
    confidence: null,
    created_at: "2026-04-29T00:00:00Z",
    superseded_by: null,
    ...overrides,
  }
}

describe("POST /api/skills/[skillName]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 202 JSON when a skill is pending", async () => {
    vi.mocked(runContentSkill).mockResolvedValue(
      buildSkillResult({ status: "pending" }),
    )

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("contentId", "9")

    const response = await POST(
      buildRequest("http://localhost/api/skills/summarization?mode=json", formData),
      {
        params: Promise.resolve({ skillName: "summarization" }),
      },
    )

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({
      message: "summarization queued.",
      skillResult: buildSkillResult({ status: "pending" }),
    })
    expect(runContentSkill).toHaveBeenCalledWith(4, 9, "summarization")
  })

  it("returns 200 JSON when a skill completes immediately", async () => {
    vi.mocked(runContentSkill).mockResolvedValue(buildSkillResult({}))

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("contentId", "9")

    const response = await POST(
      buildRequest("http://localhost/api/skills/summarization?mode=json", formData),
      {
        params: Promise.resolve({ skillName: "summarization" }),
      },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: "summarization completed.",
      skillResult: buildSkillResult({}),
    })
  })

  it("returns 400 JSON when a skill fails", async () => {
    vi.mocked(runContentSkill).mockResolvedValue(
      buildSkillResult({ status: "failed", error_message: "Skill failed." }),
    )

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("contentId", "9")

    const response = await POST(
      buildRequest("http://localhost/api/skills/summarization?mode=json", formData),
      {
        params: Promise.resolve({ skillName: "summarization" }),
      },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: "Skill failed.",
      skillResult: buildSkillResult({
        status: "failed",
        error_message: "Skill failed.",
      }),
    })
  })

  it("redirects with a queued message when a skill is running in redirect mode", async () => {
    vi.mocked(runContentSkill).mockResolvedValue(
      buildSkillResult({ status: "running" }),
    )

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("contentId", "9")
    formData.set("redirectTo", "/content/9?project=4")

    const response = await POST(
      buildRequest("http://localhost/api/skills/summarization", formData),
      {
        params: Promise.resolve({ skillName: "summarization" }),
      },
    )

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/content/9?project=4&message=summarization+queued.",
    )
  })

  it("redirects with an error when a skill result fails in redirect mode", async () => {
    vi.mocked(runContentSkill).mockResolvedValue(
      buildSkillResult({ status: "failed", error_message: "Skill failed." }),
    )

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("contentId", "9")
    formData.set("redirectTo", "/content/9?project=4")

    const response = await POST(
      buildRequest("http://localhost/api/skills/summarization", formData),
      {
        params: Promise.resolve({ skillName: "summarization" }),
      },
    )

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/content/9?project=4&error=Skill+failed.",
    )
  })

  it("returns 400 JSON when the API helper throws", async () => {
    vi.mocked(runContentSkill).mockRejectedValue(new Error("Backend failure"))

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("contentId", "9")

    const response = await POST(
      buildRequest("http://localhost/api/skills/summarization?mode=json", formData),
      {
        params: Promise.resolve({ skillName: "summarization" }),
      },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: "Backend failure",
    })
  })

  it("redirects with a fallback error when a non-Error value is thrown", async () => {
    vi.mocked(runContentSkill).mockRejectedValue("boom")

    const formData = new FormData()
    formData.set("projectId", "4")
    formData.set("contentId", "9")

    const response = await POST(
      buildRequest("http://localhost/api/skills/summarization", formData),
      {
        params: Promise.resolve({ skillName: "summarization" }),
      },
    )

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/?error=Unable+to+run+summarization.",
    )
  })
})
