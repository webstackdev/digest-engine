import { beforeEach, describe, expect, it, vi } from "vitest"

import { createMessageThread, getMessageThreads } from "@/lib/api"

import { GET, POST } from "./route"

vi.mock("@/lib/api", () => ({
  createMessageThread: vi.fn(),
  getMessageThreads: vi.fn(),
}))

describe("/api/messages/threads route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns message threads from the backend helper", async () => {
    vi.mocked(getMessageThreads).mockResolvedValue([
      {
        id: 3,
        counterpart: {
          id: 8,
          username: "maya",
          display_name: "Maya",
          avatar_url: null,
          avatar_thumbnail_url: null,
        },
        has_unread: true,
        last_message_preview: "Can you review this draft?",
        last_message_at: "2026-05-03T10:00:00Z",
        last_read_at: null,
        created_at: "2026-05-01T10:00:00Z",
      },
    ])

    const response = await GET()

    expect(getMessageThreads).toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ id: 3, has_unread: true }),
    ])
  })

  it("routes thread creation to the backend helper", async () => {
    vi.mocked(createMessageThread).mockResolvedValue({
      id: 9,
      counterpart: {
        id: 5,
        username: "liam",
        display_name: "Liam",
        avatar_url: null,
        avatar_thumbnail_url: null,
      },
      has_unread: false,
      last_message_preview: "Hello",
      last_message_at: "2026-05-03T10:00:00Z",
      last_read_at: "2026-05-03T10:00:00Z",
      created_at: "2026-05-03T10:00:00Z",
    })

    const response = await POST(
      new Request("http://localhost/api/messages/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_user_id: 5,
          opening_message: "Hello",
        }),
      }),
    )

    expect(createMessageThread).toHaveBeenCalledWith({
      recipient_user_id: 5,
      opening_message: "Hello",
    })
    expect(response.status).toBe(201)
  })
})