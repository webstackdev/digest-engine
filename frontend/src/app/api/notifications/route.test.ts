import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  getNotifications,
  readAllNotifications,
  readNotification,
} from "@/lib/api"

import { GET, PATCH } from "./route"

vi.mock("@/lib/api", () => ({
  getNotifications: vi.fn(),
  readAllNotifications: vi.fn(),
  readNotification: vi.fn(),
}))

describe("/api/notifications route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns notifications from the backend helper", async () => {
    vi.mocked(getNotifications).mockResolvedValue([
      {
        id: 1,
        project: 3,
        level: "info",
        body: "Draft ready",
        link_path: "/drafts",
        metadata: {},
        created_at: "2026-05-03T10:00:00Z",
        read_at: null,
        is_read: false,
      },
    ])

    const response = await GET(
      new Request("http://localhost/api/notifications?unread=true"),
    )

    expect(getNotifications).toHaveBeenCalledWith({ unread: true })
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ id: 1, body: "Draft ready" }),
    ])
  })

  it("routes individual read actions to the backend helper", async () => {
    vi.mocked(readNotification).mockResolvedValue({
      id: 7,
      project: null,
      level: "success",
      body: "Read now",
      link_path: "",
      metadata: {},
      created_at: "2026-05-03T10:00:00Z",
      read_at: "2026-05-03T10:01:00Z",
      is_read: true,
    })

    const response = await PATCH(
      new Request("http://localhost/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", notification_id: 7 }),
      }),
    )

    expect(readNotification).toHaveBeenCalledWith(7)
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ id: 7, is_read: true }),
    )
  })

  it("routes mark-all actions to the backend helper", async () => {
    vi.mocked(readAllNotifications).mockResolvedValue({ updated_count: 4 })

    const response = await PATCH(
      new Request("http://localhost/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read_all" }),
      }),
    )

    expect(readAllNotifications).toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ updated_count: 4 })
  })
})
