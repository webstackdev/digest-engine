import { beforeEach, describe, expect, it, vi } from "vitest"

import { createThreadMessage, getThreadMessages } from "@/lib/api"

import { GET, POST } from "./route"

vi.mock("@/lib/api", () => ({
  createThreadMessage: vi.fn(),
  getThreadMessages: vi.fn(),
}))

describe("/api/messages/threads/[threadId]/messages route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns thread messages from the backend helper", async () => {
    vi.mocked(getThreadMessages).mockResolvedValue([
      {
        id: 14,
        thread: 3,
        sender: 8,
        sender_username: "maya",
        sender_display_name: "Maya",
        body: "Can you review this draft?",
        created_at: "2026-05-03T10:00:00Z",
        edited_at: null,
      },
    ])

    const response = await GET(new Request("http://localhost/api/messages"), {
      params: Promise.resolve({ threadId: "3" }),
    })

    expect(getThreadMessages).toHaveBeenCalledWith(3)
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ id: 14, thread: 3 }),
    ])
  })

  it("routes message creation to the backend helper", async () => {
    vi.mocked(createThreadMessage).mockResolvedValue({
      id: 15,
      thread: 3,
      sender: 4,
      sender_username: "editor",
      sender_display_name: "Editor",
      body: "On it.",
      created_at: "2026-05-03T10:01:00Z",
      edited_at: null,
    })

    const response = await POST(
      new Request("http://localhost/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "On it." }),
      }),
      {
        params: Promise.resolve({ threadId: "3" }),
      },
    )

    expect(createThreadMessage).toHaveBeenCalledWith(3, { body: "On it." })
    expect(response.status).toBe(201)
  })
})
