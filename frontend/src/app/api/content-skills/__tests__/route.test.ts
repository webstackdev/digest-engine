import { beforeEach, describe, expect, it, vi } from "vitest"

import { getContentSkillResults } from "@/lib/api"
import type { SkillResult } from "@/lib/types"

import { GET } from "../route"

vi.mock("@/lib/api", () => ({
  getContentSkillResults: vi.fn(),
}))

describe("GET /api/content-skills", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 if projectId or contentId are missing", async () => {
    const request = new Request(
      "http://localhost/api/content-skills?projectId=123",
    )

    const response = await GET(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "projectId and contentId are required.",
    })
  })

  it("returns data on success", async () => {
    const mockData: SkillResult[] = [
      {
        id: 11,
        content: 456,
        project: 123,
        skill_name: "summarization",
        status: "completed",
        result_data: { summary: "Concise summary" },
        error_message: "",
        model_used: "test-model",
        latency_ms: 42,
        confidence: null,
        created_at: "2026-04-29T00:00:00Z",
        superseded_by: null,
      },
    ]
    vi.mocked(getContentSkillResults).mockResolvedValue(mockData)

    const request = new Request(
      "http://localhost/api/content-skills?projectId=123&contentId=456",
    )
    const response = await GET(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(mockData)
    expect(getContentSkillResults).toHaveBeenCalledWith(123, 456)
  })

  it("returns 400 and the thrown error message when the API helper fails", async () => {
    vi.mocked(getContentSkillResults).mockRejectedValue(
      new Error("Database failure"),
    )

    const request = new Request(
      "http://localhost/api/content-skills?projectId=1&contentId=1",
    )
    const response = await GET(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Database failure",
    })
  })

  it("returns a fallback message when a non-Error value is thrown", async () => {
    vi.mocked(getContentSkillResults).mockRejectedValue("boom")

    const request = new Request(
      "http://localhost/api/content-skills?projectId=1&contentId=1",
    )
    const response = await GET(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Unable to load content skill results.",
    })
  })
})
