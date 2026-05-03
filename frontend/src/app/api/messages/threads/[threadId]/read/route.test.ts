import { beforeEach, describe, expect, it, vi } from "vitest"

import { markThreadRead } from "@/lib/api"

import { POST } from "./route"

vi.mock("@/lib/api", () => ({
  markThreadRead: vi.fn(),
}))

describe("/api/messages/threads/[threadId]/read route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("routes read markers to the backend helper", async () => {
    vi.mocked(markThreadRead).mockResolvedValue({
      thread_id: 3,
      last_read_at: "2026-05-03T10:02:00Z",
    })

    const response = await POST(new Request("http://localhost/api/messages/read"), {
      params: Promise.resolve({ threadId: "3" }),
    })

    expect(markThreadRead).toHaveBeenCalledWith(3)
    await expect(response.json()).resolves.toEqual({
      thread_id: 3,
      last_read_at: "2026-05-03T10:02:00Z",
    })
  })
})