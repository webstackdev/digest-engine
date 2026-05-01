import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SkillActionBar } from "@/app/content/[id]/_components/SkillActionBar"
import { QueryProvider } from "@/components/shared/QueryProvider"

const { refreshMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    refresh: refreshMock,
  }),
}))

describe("SkillActionBar", () => {
  beforeEach(() => {
    refreshMock.mockReset()
    vi.restoreAllMocks()
  })

  it("disables summarization when the content cannot be summarized", () => {
    render(
      <QueryProvider>
        <SkillActionBar
          projectId={4}
          contentId={9}
          canSummarize={false}
          initialPendingSkills={[]}
        />
      </QueryProvider>,
    )

    expect(screen.getByRole("button", { name: "Summarize" })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Explain relevance" }),
    ).toBeEnabled()
  })

  it("shows a success message and refreshes after a completed skill request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: "Summarization started.",
        skillResult: {
          id: 7,
          content: 9,
          project: 4,
          skill_name: "summarization",
          status: "completed",
          result_data: null,
          error_message: "",
          model_used: "test-model",
          latency_ms: 120,
          confidence: null,
          created_at: "2026-04-28T00:00:00Z",
          superseded_by: null,
        },
      }),
    })

    vi.stubGlobal("fetch", fetchMock)

    render(
      <QueryProvider>
        <SkillActionBar
          projectId={4}
          contentId={9}
          canSummarize
          initialPendingSkills={[]}
        />
      </QueryProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Summarize" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/skills/summarization?mode=json",
        expect.objectContaining({ method: "POST" }),
      )
    })

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Summarization started.",
    )
    expect(refreshMock).toHaveBeenCalled()
  })

  it("polls pending initial skills and refreshes when they finish", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 7,
          content: 9,
          project: 4,
          skill_name: "summarization",
          status: "completed",
          result_data: null,
          error_message: "",
          model_used: "test-model",
          latency_ms: 120,
          confidence: null,
          created_at: "2026-04-28T00:00:00Z",
          superseded_by: null,
        },
      ],
    })

    vi.stubGlobal("fetch", fetchMock)

    render(
      <QueryProvider>
        <SkillActionBar
          projectId={4}
          contentId={9}
          canSummarize
          initialPendingSkills={["summarization"]}
        />
      </QueryProvider>,
    )

    expect(
      screen.getByRole("button", { name: "Summarizing..." }),
    ).toBeDisabled()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/content-skills?projectId=4&contentId=9",
        { cache: "no-store" },
      )
    })

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled()
    })
  })

  it("queues relevance scoring, reports pending state, and refreshes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "Relevance scoring queued.",
          skillResult: {
            id: 8,
            content: 9,
            project: 4,
            skill_name: "relevance_scoring",
            status: "pending",
            result_data: null,
            error_message: "",
            model_used: "test-model",
            latency_ms: 120,
            confidence: null,
            created_at: "2026-04-28T00:00:00Z",
            superseded_by: null,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 8,
            content: 9,
            project: 4,
            skill_name: "relevance_scoring",
            status: "running",
            result_data: null,
            error_message: "",
            model_used: "test-model",
            latency_ms: 120,
            confidence: null,
            created_at: "2026-04-28T00:00:00Z",
            superseded_by: null,
          },
        ],
      })

    vi.stubGlobal("fetch", fetchMock)

    render(
      <QueryProvider>
        <SkillActionBar
          projectId={4}
          contentId={9}
          canSummarize
          initialPendingSkills={[]}
        />
      </QueryProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Explain relevance" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        "/api/skills/relevance_scoring?mode=json",
        expect.objectContaining({ method: "POST" }),
      )
    })

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Relevance scoring queued.",
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/content-skills?projectId=4&contentId=9",
        { cache: "no-store" },
      )
    })

    expect(
      screen.getByRole("button", { name: "Scoring relevance..." }),
    ).toBeDisabled()
    expect(refreshMock).toHaveBeenCalled()
  })

  it("renders an error message when the skill request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Unable to run summarization." }),
    })

    vi.stubGlobal("fetch", fetchMock)

    render(
      <QueryProvider>
        <SkillActionBar
          projectId={4}
          contentId={9}
          canSummarize
          initialPendingSkills={[]}
        />
      </QueryProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Summarize" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to run summarization.",
    )
    expect(refreshMock).not.toHaveBeenCalled()
  })
})
