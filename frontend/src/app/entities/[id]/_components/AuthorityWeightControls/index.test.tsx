import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AuthorityWeightControls } from "@/app/entities/[id]/_components/AuthorityWeightControls"
import type { ProjectConfig } from "@/lib/types"

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

function createProjectConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    id: 3,
    project: 1,
    draft_schedule_cron: "",
    authority_weight_mention: 0.2,
    authority_weight_engagement: 0.15,
    authority_weight_recency: 0.15,
    authority_weight_source_quality: 0.15,
    authority_weight_cross_newsletter: 0.2,
    authority_weight_feedback: 0.1,
    authority_weight_duplicate: 0.05,
    upvote_authority_weight: 0.05,
    downvote_authority_weight: -0.05,
    authority_decay_rate: 0.9,
    ...overrides,
  }
}

describe("AuthorityWeightControls", () => {
  beforeEach(() => {
    refreshMock.mockReset()
    vi.restoreAllMocks()
  })

  it("saves weights through the JSON route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Authority weights saved." }),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(
      <AuthorityWeightControls
        projectConfig={createProjectConfig()}
        projectId={1}
        redirectTo="/entities/7?project=1"
      />,
    )

    fireEvent.change(screen.getByRole("slider", { name: "Engagement" }), {
      target: { value: "0.33" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save weights" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/projects/1/authority-settings?mode=json",
        expect.objectContaining({ method: "POST" }),
      )
    })

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Authority weights saved.",
    )
    expect(refreshMock).toHaveBeenCalled()
  })

  it("saves and recomputes when requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Authority weights saved and recomputed." }),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(
      <AuthorityWeightControls
        projectConfig={createProjectConfig()}
        projectId={1}
        redirectTo="/entities/7?project=1"
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Save and recompute" }))

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Authority weights saved and recomputed.",
    )
    expect(refreshMock).toHaveBeenCalled()
  })
})
